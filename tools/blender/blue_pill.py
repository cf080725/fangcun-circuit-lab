"""Build the Blue Pill fixed-detail GLB with Blender 4.5 LTS.

Run Blender in background mode.
  blender -b -t 4 -P tools/blender/blue_pill.py -- --output dist/models/blue-pill-detail.glb
Append --blend ../blue-pill-detail.blend for the editable scene or
--render research/qa/blue-pill-blender.png for the studio preview.

The workbench interprets the GLB's numeric coordinates as centimetres. The
fixed assembly uses +Y up, the PCB centred on X/Z and the USB mouth facing -Z.
The two detail variants preserve the bench and photographic teaching layouts.
Headers, pin markings, boot jumpers, SWD, reset and LEDs are drawn by the app.

The physical references are Avandalen's Blue Pill photograph (CC BY-SA 4.0),
the lab's 23 × 53 mm board and 15.24 × 2.54 mm header geometry, and the
STM32F103C8 LQFP48 package drawing. Copper routes and rear passives are
illustrative geometry.

https://commons.wikimedia.org/wiki/File:Blue_Pill.jpg
https://www.st.com/resource/en/datasheet/stm32f103c8.pdf
"""

import argparse
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


WIDTH, LENGTH = 2.30, 5.30
BOTTOM, TOP = .206, .352
HEADER_X, PITCH, DRILL_RADIUS, DRILL_SEGMENTS = .762, .254, .055, 20


def blender_point(point):
    """Map workbench axes to Blender's Z-up axes before the Y-up GLB export."""
    x, y, z = point
    return (x, -z, y)


def srgb(hex_color):
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb)


def material(name, hex_color, metallic=0, roughness=.4):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    color = (*srgb(hex_color), 1)
    mat.diffuse_color = color
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return mat


def empty(name):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    return root


def loops_faces(count, layers):
    return [
        (i + count * row, (i + 1) % count + count * row,
         (i + 1) % count + count * (row + 1), i + count * (row + 1))
        for row in range(layers - 1) for i in range(count)
    ]


def rounded_outline(width, depth, radius, segments=5):
    corners = ((width / 2 - radius, depth / 2 - radius),
               (-width / 2 + radius, depth / 2 - radius),
               (-width / 2 + radius, -depth / 2 + radius),
               (width / 2 - radius, -depth / 2 + radius))
    return [
        (x + radius * math.cos(angle), z + radius * math.sin(angle))
        for corner, (x, z) in enumerate(corners)
        for angle in [(corner + step / segments) * math.pi / 2 for step in range(segments + 1)]
    ]


def rotate(x, z, angle):
    return x * math.cos(angle) + z * math.sin(angle), -x * math.sin(angle) + z * math.cos(angle)


class MeshBatch:
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.materials = []
        self.indices = []
        self.smooth_faces = []

    def add(self, vertices, faces, mat, smooth=False):
        offset = len(self.vertices)
        self.vertices.extend(blender_point(point) for point in vertices)
        self.faces.extend(tuple(offset + index for index in face) for face in faces)
        if mat not in self.materials:
            self.materials.append(mat)
        self.indices.extend([self.materials.index(mat)] * len(faces))
        self.smooth_faces.extend([smooth] * len(faces))

    def loft(self, profiles, mat, center=(0, 0), angle=0, sides=None):
        # Each profile is (height, width, depth, corner radius).
        vertices = []
        for y, width, depth, radius in profiles:
            for x, z in rounded_outline(width, depth, radius):
                rx, rz = rotate(x, z, angle)
                vertices.append((center[0] + rx, y, center[1] + rz))
        count = len(vertices) // len(profiles)
        faces = loops_faces(count, len(profiles))
        self.add(vertices, [tuple(reversed(range(count))), *faces,
                            tuple(range(len(vertices) - count, len(vertices)))], mat)
        if sides:
            for row, surface in enumerate(sides):
                if surface not in self.materials:
                    self.materials.append(surface)
                start = len(self.indices) - len(faces) - 1 + row * count
                self.indices[start:start + count] = [self.materials.index(surface)] * count

    def box(self, center, dimensions, mat, bevel=.004, angle=0):
        x, y, z = center
        width, height, depth = dimensions
        r = min(bevel, width / 3, depth / 3)
        if bevel == 0:
            coords = [(x + px, y + py, z + pz)
                      for px, py, pz in ((-width/2,-height/2,-depth/2),(width/2,-height/2,-depth/2),
                                        (width/2,-height/2,depth/2),(-width/2,-height/2,depth/2),
                                        (-width/2,height/2,-depth/2),(width/2,height/2,-depth/2),
                                        (width/2,height/2,depth/2),(-width/2,height/2,depth/2))]
            if angle:
                coords = [(x + dx, py, z + dz) for px, py, pz in coords
                          for dx, dz in [rotate(px - x, pz - z, angle)]]
            self.add(coords, [(3,2,1,0), *loops_faces(4, 2), (4,5,6,7)], mat)
            return
        lip = min(r, height / 4)
        self.loft([(y-height/2, width-lip, depth-lip, r),
                   (y-height/2+lip, width, depth, r),
                   (y+height/2-lip, width, depth, r),
                   (y+height/2, width-lip, depth-lip, r)], mat, (x, z), angle)

    def cylindrical(self, x, z, sections, mat, segments=24, caps=False):
        vertices = [
            (x + radius * math.cos(a), y, z + radius * math.sin(a))
            for radius, y in sections for a in [i * math.tau / segments for i in range(segments)]
        ]
        faces = loops_faces(segments, len(sections))
        if caps:
            faces.extend([tuple(reversed(range(segments))),
                          tuple(range(len(vertices) - segments, len(vertices)))])
        self.add(vertices, [tuple(reversed(face)) for face in faces], mat, smooth=not caps)

    def ribbon(self, route, height, width, mat):
        for (x, z), (end_x, end_z) in zip(route, route[1:]):
            dx, dz = end_x - x, end_z - z
            length = math.hypot(dx, dz)
            if length < 1e-6:
                continue
            nx, nz = -dz * width / (2 * length), dx * width / (2 * length)
            face = (3,2,1,0) if height < BOTTOM else (0,1,2,3)
            self.add([(x+nx,height,z+nz),(end_x+nx,height,end_z+nz),
                      (end_x-nx,height,end_z-nz),(x-nx,height,z-nz)], [face], mat)

    def finish(self, name, parent=None, closed=True):
        data = bpy.data.meshes.new(name)
        data.from_pydata(self.vertices, [], self.faces)
        for mat in self.materials:
            data.materials.append(mat)
        for polygon, index, smooth in zip(data.polygons, self.indices, self.smooth_faces):
            polygon.material_index = index
            polygon.use_smooth = smooth
        if closed:
            bm = bmesh.new()
            bm.from_mesh(data)
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            bm.to_mesh(data)
            bm.free()
        data.update()
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.parent = parent
        return obj


def cut_mesh(target, cutter):
    bpy.context.view_layer.objects.active = target
    modifier = target.modifiers.new("Machined holes", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def board(parent, mats):
    holes = [(x, (index - 9.5) * PITCH) for x in [-HEADER_X, HEADER_X] for index in range(20)]
    laminate = MeshBatch()
    laminate.loft([(BOTTOM, WIDTH-.02, LENGTH-.02, .047),
                   (BOTTOM+.009, WIDTH, LENGTH, .048),
                   (TOP-.007, WIDTH, LENGTH, .048),
                   (TOP, WIDTH-.014, LENGTH-.014, .045)],
                  mats["mask"], sides=[mats["mask"], mats["fr4"], mats["mask"]])
    pcb = laminate.finish("BP_PCB_MASK_AND_LAMINATE", parent)
    drills = MeshBatch()
    for x, z in holes:
        drills.cylindrical(x, z, [(DRILL_RADIUS, BOTTOM-.04), (DRILL_RADIUS, TOP+.04)],
                           mats["mask"], segments=DRILL_SEGMENTS, caps=True)
    cut_mesh(pcb, drills.finish("Temporary header drill tools"))

    plating = MeshBatch()
    for x, z in holes:
        # Solder-tinned annuli and continuous plated walls through both faces.
        plating.cylindrical(x, z, [(.054, BOTTOM-.003), (.096, BOTTOM-.003), (.096, BOTTOM+.001),
                                  (.056, BOTTOM+.001), (.056, TOP-.001), (.096, TOP-.001),
                                  (.096, TOP+.003), (.054, TOP+.003), (.054, BOTTOM-.003)],
                            mats["tin"], segments=DRILL_SEGMENTS)
    plating.finish("BP_PLATED_HEADER_HOLES", parent, closed=False)

    copper = MeshBatch()
    for sign in [-1, 1]:
        for index in range(20):
            z = (index - 9.5) * PITCH
            final_z = z * .21 + .065
            knee = z * .73 + final_z * .27
            # Stagger the fine traces beneath the blue solder mask.
            near = .619 - index * .0084
            route = [(sign*.662,z),(sign*.634,z),(sign*near,knee),
                     (sign*near,final_z),(sign*(.42+(index%3)*.018),final_z)]
            copper.ribbon(route, TOP+.0007, .007, mats["trace"])
            copper.ribbon([(sign*.664,z),(sign*.587,z),(sign*.31,z*.65),
                           (sign*.17,z*.65)], BOTTOM-.0006, .010, mats["trace_rear"])
        edge_x = sign * HEADER_X
        border = [(edge_x-.126,-2.526),(edge_x+.126,-2.526),(edge_x+.126,2.526),
                  (edge_x-.126,2.526),(edge_x-.126,-2.526)]
        copper.ribbon(border, TOP+.0013, .008, mats["silk"])
    copper.finish("BP_TRACE_AND_PIN_ROW_INK", parent, closed=False)


def connector(parent, mats):
    shell = MeshBatch()
    outer = [(-.315,.356),(.315,.356),(.387,.414),(.387,.618),(.367,.637),
             (-.367,.637),(-.387,.618),(-.387,.414)]
    inner = [(-.301,.382),(.301,.382),(.360,.428),(.360,.608),(.347,.615),
             (-.347,.615),(-.360,.608),(-.360,.428)]
    front, back = -2.692, -2.052
    vertices = [(x,y,z) for points,z in [(outer,front),(outer,back),(inner,back),(inner,front)] for x,y in points]
    count = len(outer)
    shell.add(vertices, [*loops_faces(count,4), *[(3*count+i,3*count+(i+1)%count,(i+1)%count,i)
                                                  for i in range(count)]], mats["steel"])
    for x in [-.342,.342]:
        shell.box((x,.571,-2.633),(.031,.034,.104),mats["steel"],.007)
    for x in [-.236,.236]:
        shell.box((x,.638,-2.408),(.105,.009,.120),mats["steel_light"],.011)
        shell.box((x,.644,-2.451),(.051,.009,.044),mats["steel_dark"],.004)
    for x in [-.438,.438]:
        for z in [-2.516,-2.165]:
            shell.box((x,.364,z),(.127,.023,.119),mats["tin"],.012)
            shell.box((x*.978,.386,z),(.073,.036,.064),mats["steel"],.009)
    shell.finish("BP_USB_STAMPED_OPEN_SHELL", parent)

    tongue = MeshBatch()
    tongue.box((0,.421,-2.337),(.538,.075,.425),mats["usb_plastic"],.015)
    tongue.box((0,.475,-2.081),(.652,.190,.084),mats["usb_plastic"],.008)
    for index in range(5):
        x = (index - 2) * .065
        tongue.box((x,.465,-2.385),(.030,.013,.168),mats["gold"],.003)
        tongue.box((x,.363,-1.988),(.040,.021,.141),mats["tin"],.005)
    tongue.finish("BP_USB_TONGUE_AND_FIVE_CONTACTS", parent)


def chip(parent, mats, tag, center_z, angle):
    package = MeshBatch()
    package.loft([(.373,.668,.668,.029),(.397,.700,.700,.034),(.459,.690,.690,.031),
                  (.482,.647,.647,.024)], mats["mold"], (0, center_z), angle)
    body = package.finish(f"BP_CHIP_{tag}_PACKAGE", parent)
    ix, iz = rotate(-.243, -.243, angle)
    dot = MeshBatch()
    dot.cylindrical(ix, center_z+iz, [(.025,.471),(.025,.501)], mats["mold"], caps=True)
    cut_mesh(body, dot.finish("Temporary pin-one laser recess"))
    recess = MeshBatch()
    recess.cylindrical(ix, center_z+iz, [(.020,.470),(.020,.472)], mats["mark"], caps=True)
    recess.finish(f"BP_CHIP_{tag}_PIN_ONE", parent)

    leads = MeshBatch()
    profile = [(.329,.411),(.352,.411),(.371,.405),(.393,.371),(.411,.362),(.453,.362),
               (.453,.349),(.407,.349),(.385,.360),(.361,.396),(.329,.396)]
    for side in range(4):
        direction = angle + side * math.pi / 2
        for index in range(12):
            center_x = (index - 5.5) * .05
            vertices = [(rx, y, center_z+rz) for offset in [-.0105,.0105] for reach,y in profile
                        for rx,rz in [rotate(center_x+offset,-reach,direction)]]
            count = len(profile)
            leads.add(vertices, [tuple(reversed(range(count))), *loops_faces(count,2),
                                  tuple(range(count,2*count))], mats["tin"])
    leads.finish(f"BP_CHIP_{tag}_48_GULLWING_LEADS", parent)


def crystal_8mhz(batch, mats, z):
    batch.loft([(.353,.867,.367,.172),(.369,.877,.375,.179),(.386,.834,.332,.159),
                (.404,.826,.324,.157)], mats["tin"], (.02,z))
    batch.loft([(.382,.794,.314,.151),(.409,.823,.321,.157),(.566,.808,.310,.151),
                (.588,.753,.269,.130)], mats["steel"], (.02,z))
    batch.loft([(.566,.785,.295,.141),(.574,.761,.277,.135)], mats["steel_light"], (.02,z))


def smd(batch, mats, x, z, width, depth, dielectric=True, y=TOP, rear=False):
    sign = -1 if rear else 1
    batch.box((x,y+sign*.020,z),(width*.76,.032,depth),mats["ceramic" if dielectric else "mold"],.006)
    for offset in [-1,1]:
        batch.box((x+offset*width*.43,y+sign*.018,z),(width*.20,.034,depth+.005),mats["tin"],.004)


def regulator(batch, mats, x, z, y, rear=False):
    sign = -1 if rear else 1
    batch.box((x,y+sign*.041,z),(.294,.072,.144),mats["mold"],.012)
    for dx,dz in [(-.091,.091),(.091,.091),(0,-.091)]:
        batch.box((x+dx,y+sign*.012,z+dz),(.046,.020,.064),mats["tin"],.004)


def fixed_details(common, bench, inspection, mats):
    rear = MeshBatch()
    regulator(rear,mats,.26,-1.78,BOTTOM,rear=True)
    for x,z,w,d,dielectric in [(.42,-1.54,.116,.069,True),(.31,-1.35,.090,.063,True),
                               (-.27,-1.68,.121,.073,True),(-.49,-1.79,.084,.052,False)]:
        smd(rear,mats,x,z,w,d,dielectric,BOTTOM,rear=True)
    rear.finish("BP_BACKSIDE_REGULATOR_AND_PASSIVES", common)

    chip(bench,mats,"BENCH",.12,0)
    chip(inspection,mats,"INSPECTION",.056,math.pi/4)

    bench_parts = MeshBatch()
    crystal_8mhz(bench_parts,mats,-.80)
    # The bench uses an axial watch crystal above the live reset/LED area.
    for radius,z0,z1,metal in [(.066,-1.555,-1.054,"steel"),(.055,-1.573,-1.555,"steel_light")]:
        count=24
        points=[(-.44+radius*math.cos(i*math.tau/count),.434+radius*math.sin(i*math.tau/count),z)
                for z in [z0,z1] for i in range(count)]
        bench_parts.add(points,[tuple(reversed(range(count))),*loops_faces(count,2),tuple(range(count,count*2))],mats[metal])
    for x in [-.471,-.409]:
        bench_parts.box((x,.386,-.998),(.022,.046,.153),mats["tin"],.004)
    regulator(bench_parts,mats,.25,-1.53,TOP)
    for x,z,w,d,dielectric in [(-.48,-1.82,.13,.075,True),(.50,-.81,.13,.075,True),
                                (-.50,-.57,.115,.064,True),(.49,.34,.116,.07,True),
                                (-.47,.58,.10,.055,False),(.26,.76,.12,.064,False),
                                (-.24,1.27,.11,.06,False),(.46,1.44,.115,.063,True)]:
        smd(bench_parts,mats,x,z,w,d,dielectric)
    bench_parts.finish("BP_BENCH_CRYSTALS_AND_PASSIVES", bench)

    photo_parts = MeshBatch()
    crystal_8mhz(photo_parts,mats,.951)
    photo_parts.box((0,.428,1.48),(.77,.142,.34),mats["mold"],.026)
    for x in [-.4,.4]:
        for z in [1.35,1.61]:
            photo_parts.box((x,.372,z),(.092,.032,.076),mats["tin"],.005)
    photo_parts.finish("BP_INSPECTION_CRYSTALS", inspection)


def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def set_up_preview(bench):
    for obj in [bench, *bench.children_recursive]:
        obj.hide_set(True)
        obj.hide_render = True
    stage = MeshBatch()
    stage.box((0,.005,0),(200,.02,200),material("Evidence background","c5d5da",roughness=.77),0)
    stage.finish("Evidence ground").hide_set(True)
    scene = bpy.context.scene
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Evidence world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.52,.64,.74,1)
    background.inputs["Strength"].default_value = .41
    for name,point,energy,size in [("Soft key",(-4,5,-4),590,5),
                                   ("Fill",(4,3,1),280,4),("Edge",(-2,3,4),430,3)]:
        light=bpy.data.lights.new(name,"AREA")
        light.energy=energy
        light.shape="DISK"
        light.size=size
        obj=bpy.data.objects.new(name,light)
        bpy.context.collection.objects.link(obj)
        obj.location=blender_point(point)
        aim(obj,blender_point((0,.2,0)))
        obj.hide_set(True)
    camera=bpy.data.cameras.new("Evidence camera")
    camera.type="ORTHO"
    camera.ortho_scale=6.42
    obj=bpy.data.objects.new("Evidence camera",camera)
    bpy.context.collection.objects.link(obj)
    obj.location=blender_point((3.0,7.0,-4.4))
    aim(obj,blender_point((0,.20,0)))
    scene.camera=obj
    obj.hide_set(True)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                region=area.spaces.active.region_3d
                region.view_location=blender_point((0,.20,0))
                region.view_rotation=obj.rotation_euler.to_quaternion()
                region.view_distance=7.2
                region.view_perspective="ORTHO"
                area.spaces.active.shading.color_type="MATERIAL"
    scene.render.engine="CYCLES"
    scene.cycles.samples=20
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1000
    scene.render.resolution_y=1000
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    return scene


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--blend",type=Path)
    parser.add_argument("--render",type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats={
        "mask": material("Blue solder mask","08658e",.10,.32),
        "fr4": material("Exposed board laminate","b58d49",.13,.58),
        "tin": material("Tinned solder and pin plating","c0cbd0",.77,.30),
        "trace": material("Subsurface copper under mask","0c759c",.18,.42),
        "trace_rear": material("Back copper under mask","105979",.17,.43),
        "silk": material("Pale PCB screen ink","b5d1d8",0,.67),
        "steel": material("Brushed receptacle and crystal steel","b9c2c8",.92,.25),
        "steel_light": material("Folded steel edge","e1e7e8",.86,.27),
        "steel_dark": material("Shield retaining recess","555d62",.79,.41),
        "gold": material("Micro-USB gold contacts","d3a548",.82,.26),
        "mold": material("Chip and package molding resin","242b30",.04,.62),
        "mark": material("Shallow pin-one mark","363d41",.09,.65),
        "usb_plastic": material("Receptacle tongue insulator","22292c",.02,.52),
        "ceramic": material("Multilayer ceramic passive","bd9b6b",.15,.49),
    }
    common=empty("BP_COMMON")
    common["WorkbenchUnits"]="centimetres"
    common["Axes"]="+Y up; USB toward -Z"
    bench=empty("BP_BENCH_DETAILS")
    inspection=empty("BP_INSPECTION_DETAILS")
    board(common,mats)
    connector(common,mats)
    fixed_details(common,bench,inspection,mats)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()),export_format="GLB",
                              export_yup=True,export_extras=True)
    preview = set_up_preview(bench) if args.blend or args.render else None
    if args.blend:
        args.blend.parent.mkdir(parents=True,exist_ok=True)
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()),compress=True)
    if args.render:
        args.render.parent.mkdir(parents=True,exist_ok=True)
        preview.render.filepath=str(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
