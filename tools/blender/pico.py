"""Build the original Raspberry Pi Pico Rev3 fixed-detail GLB with Blender 4.5 LTS.

  blender -b -t 5 -P tools/blender/pico.py -- --output dist/models/pico-rp2040-detail.glb

Use --blend for the editable file and --render for a studio PNG. The fixed
model uses centimetres, +Y up, USB at -Z. Live BOOTSEL, GP25 LED, selectable
endpoints, labels, and any fitted header pins are placed by the site.

Nominal outlines, bores, and principal component placements are based on
Raspberry Pi Pico Rev3's official dimension drawing and STEP file. Solder mask
artwork, small component exteriors, and the USB cavity are visual reconstructions.
https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf
https://pip.raspberrypi.com/documents/RP-008311-DS
https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material, rounded_outline


WIDTH, LENGTH, BASE, TOP = 2.10, 5.10, .25, .35
HEADER_X, PITCH, DRILL = .889, .254, .05
CAST_OFFSET, PAD_RADIUS = .001, .08
MOUNT_RADIUS, MOUNT_RING = .105, .190
TOP_RINGS = [(-.57, -2.35), (.57, -2.35), (-.57, 2.35), (.57, 2.35)]
GPIO = [(x, (index - 9.5) * PITCH, index in (2, 7, 12, 17))
        for x in (-HEADER_X, HEADER_X) for index in range(20)]
SWD = [(x, 2.39, x == 0) for x in (-PITCH, 0, PITCH)]
RP2040 = (0, .050)
DATASHEET = "https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf"
STEP = "https://pip.raspberrypi.com/documents/RP-008311-DS"


def contact_axes(x, z, end):
    if end:
        return x, LENGTH / 2, 0, -1
    sign = math.copysign(1, x)
    return sign * (WIDTH / 2 - CAST_OFFSET), z, -sign, 0


def contact_cutter(contacts, end, mat):
    cutter = MeshBatch()
    for x, z, _ in contacts:
        edge_x, edge_z, _, _ = contact_axes(x, z, end)
        for center_x, center_z in [(x, z), (edge_x, edge_z)]:
            cutter.cylindrical(center_x, center_z, [(DRILL, .22), (DRILL, .38)], mat, 20, True)
    return cutter


def routed_board(root, mats):
    base = MeshBatch()
    base.loft([(BASE, WIDTH, LENGTH, .045), (BASE + .007, WIDTH, LENGTH, .045),
               (TOP - .007, WIDTH, LENGTH, .045), (TOP, WIDTH, LENGTH, .045)], mats["mask"],
              sides=[mats["edge"], mats["core"], mats["edge"]])
    pcb = base.finish("PICO_PCB", root)
    pcb["Nominal board millimetres"] = [21., 51., 1.]
    cut_mesh(pcb, contact_cutter(GPIO, False, mats["mask"]).finish("GPIO drill and router tools"))
    cut_mesh(pcb, contact_cutter(SWD, True, mats["mask"]).finish("SWD drill and router tools"))
    fixture = MeshBatch()
    for x, z in TOP_RINGS:
        fixture.cylindrical(x, z, [(MOUNT_RADIUS, .22), (MOUNT_RADIUS, .38)], mats["mask"], 32, True)
    cut_mesh(pcb, fixture.finish("Mounting drill tools"))


def ring(batch, x, z, profile, mat, sides=20):
    vertices = [(x + r * math.cos(a), y, z + r * math.sin(a)) for r, y in profile
                for a in [i * math.tau / sides for i in range(sides)]]
    batch.add(vertices, loops_faces(sides, len(profile)), mat)


def pad_outline(distance, squared, inset):
    if squared:
        tip = [(distance + PAD_RADIUS, -PAD_RADIUS), (distance + PAD_RADIUS, PAD_RADIUS)]
    else:
        tip = [(distance + PAD_RADIUS * math.cos(a), PAD_RADIUS * math.sin(a))
               for a in [math.pi * (i / 10 - .5) for i in range(11)]]
    return [(-inset, -PAD_RADIUS), *tip, (-inset, PAD_RADIUS)]


def castellation_barrel(batch, edge_x, edge_z, ux, uz, inset, mat):
    direction = math.atan2(uz, ux)
    radius = DRILL - .0005
    angle = math.acos(-inset / radius)
    points = [(edge_x + radius * math.cos(a), y, edge_z + radius * math.sin(a))
              for y in (BASE - .0009, TOP + .0009)
              for a in [direction + angle * (2*i/10 - 1) for i in range(11)]]
    batch.add(points, [(i, i+1, i+12, i+11) for i in range(10)], mat, True)


def contacts(root, positions, end, name, mat):
    pads, barrels = MeshBatch(), MeshBatch()
    inset = 0 if end else CAST_OFFSET
    for x, z, squared in positions:
        edge_x, edge_z, ux, uz = contact_axes(x, z, end)
        distance = math.hypot(x - edge_x, z - edge_z)
        path = pad_outline(distance, squared, inset)
        count = len(path)
        for bottom, top in [(BASE - .0015, BASE + .0008), (TOP - .0008, TOP + .0015)]:
            vertices = [(edge_x + ux*u + uz*v, y, edge_z + uz*u - ux*v)
                        for y in (bottom, top) for u, v in path]
            pads.add(vertices, [tuple(reversed(range(count))), *loops_faces(count, 2),
                                tuple(range(count, 2*count))], mat)
        ring(barrels, x, z, [(DRILL - .0005, BASE - .0015), (DRILL - .0005, TOP + .0015)], mat)
        castellation_barrel(barrels, edge_x, edge_z, ux, uz, inset, mat)
    contact = pads.finish(name, root)
    contact["Contact count"] = len(positions)
    contact["Drill diameter mm"] = 1.
    cut_mesh(contact, contact_cutter(positions, end, mat).finish(name + " drill tools"))
    sleeves = barrels.finish(name + " sleeves", root, closed=False)
    bpy.ops.object.select_all(action="DESELECT")
    sleeves.select_set(True)
    contact.select_set(True)
    bpy.context.view_layer.objects.active = contact
    bpy.ops.object.join()


def mounting_rings(root, mats):
    rims = MeshBatch()
    for x, z in TOP_RINGS:
        radius = MOUNT_RADIUS - .0005
        ring(rims, x, z, [(MOUNT_RING, BASE - .001), (radius, BASE - .001),
                          (radius, TOP + .001), (MOUNT_RING, TOP + .001)], mats["gold"], 32)
    obj = rims.finish("PICO_MOUNTING_RINGS", root, closed=False)
    obj["Mounting hole diameter mm"] = 2.1


def port_section(z, width, bottom, top):
    side = width / 2
    return [(x, y, z) for x, y in [(-side+.065, bottom), (side-.065, bottom), (side, bottom+.061),
                                    (side, top-.026), (side-.029, top), (-side+.029, top),
                                    (-side, top-.026), (-side, bottom+.061)]]


def micro_usb(root, mats):
    shell = MeshBatch()
    sections = [(-2.608, .676, .367, .579), (-2.659, .676, .367, .579),
                (-2.667, .733, .352, .606), (-2.620, .758, .350, .607),
                (-2.133, .758, .350, .603), (-2.117, .712, .361, .595),
                (-2.117, .642, .386, .566), (-2.608, .642, .386, .566)]
    points = [point for values in sections for point in port_section(*values)]
    last = len(points)-8
    seam = [(last+i, last+(i+1)%8, (i+1)%8, i) for i in range(8)]
    shell.add(points, [*loops_faces(8, len(sections)), *seam], mats["steel"])
    for sign in (-1, 1):
        for z in (-2.47, -2.187):
            shell.box((sign*.352, .361, z), (.099, .026, .120), mats["tin"], .012)
        shell.box((sign*.242, .609, -2.476), (.072, .004, .112), mats["dark_steel"], .020)
        shell.box((sign*.263, .612, -2.493), (.026, .006, .068), mats["steel"], .008)
        shell.box((sign*.372, .490, -2.651), (.031, .089, .054), mats["steel"], .009)
    shell.finish("PICO_MICRO_USB_OPEN_SHELL", root)

    tongue = MeshBatch()
    tongue.box((0, .479, -2.148), (.639, .212, .091), mats["mold"], .011)
    tongue.box((0, .449, -2.349), (.489, .071, .417), mats["dielectric"], .012)
    for i in range(-2, 3):
        x = i*.065
        tongue.box((x, .486, -2.379), (.031, .008, .31), mats["gold"], 0)
        tongue.box((x, .358, -2.080), (.036, .015, .108), mats["tin"], 0)
    tongue.finish("PICO_MICRO_USB_TONGUE_AND_PINS", root)


def qfn(batch, mats, x, z, width, depth, height, count, pitch, two_sides=False, pin_one=(1, 1)):
    bottom, top = TOP + .002, TOP + height
    batch.loft([(bottom, width-.013, depth-.013, .013), (bottom+.009, width, depth, .017),
                (top-.009, width, depth, .016), (top, width-.018, depth-.018, .015)],
               mats["mold"], center=(x,z))
    mark_r = min(.025, width*.07)
    batch.cylindrical(x + pin_one[0]*width*.34, z + pin_one[1]*depth*.34, [(mark_r, top), (mark_r, top+.0007)],
                       mats["mark"], 14, True)
    for i in range(count):
        offset = (i - (count-1)/2)*pitch
        for sign in (-1, 1):
            batch.box((x+sign*width/2, TOP+.005, z+offset), (.045, .012, pitch*.58), mats["tin"], 0)
            if not two_sides:
                batch.box((x+offset, TOP+.005, z+sign*depth/2), (pitch*.58, .012, .045), mats["tin"], 0)


def devices(root, mats):
    package = MeshBatch()
    qfn(package, mats, *RP2040, .70, .70, .09, 14, .04, pin_one=(-1, -1))
    chip = package.finish("PICO_RP2040_PACKAGE", root)
    chip["Part"] = "RP2040 · 7 mm QFN56"
    chip["Centre X and Z cm"] = RP2040

    flash = MeshBatch()
    qfn(flash, mats, -.38, -.64, .20, .30, .060, 4, .050, two_sides=True)
    obj = flash.finish("PICO_WINBOND_FLASH", root)
    obj["Part"] = "W25Q16JV"

    xtal = MeshBatch()
    xtal.box((-.23, TOP+.013, .905), (.320, .026, .250), mats["tin"], .017)
    xtal.box((-.23, TOP+.024, .905), (.306, .028, .231), mats["ceramic"], .022)
    xtal.box((-.23, TOP+.046, .905), (.290, .028, .221), mats["steel"], .018)
    obj = xtal.finish("PICO_12MHZ_CRYSTAL", root)
    obj["Part"] = "12 MHz crystal"

    power = MeshBatch()
    qfn(power, mats, .29, -1.46, .250, .250, .075, 4, .050, two_sides=True)
    power.box((.60, TOP+.060, -1.46), (.201, .120, .250), mats["inductor"], .013)
    for z in (-1.55, -1.37):
        power.box((.60, TOP+.014, z), (.21, .028, .078), mats["tin"], .005)
    power.box((.60, TOP+.0475, -1.89), (.169, .095, .292), mats["mold"], .010)
    for z in (-2.041, -1.739):
        power.box((.60, TOP+.010, z), (.143, .020, .060), mats["tin"], 0)
    qfn(power, mats, .64, -.72, .080, .160, .080, 2, .080, two_sides=True)
    for z in (-1.71, -1.21):
        chip_part(power, mats, .29, z, .200, .125, .125)
    obj = power.finish("PICO_RT6150_AND_POWER_COMPONENTS", root)
    obj["Part"] = "RT6150 buck-boost converter and nearby power devices"


def chip_part(batch, mats, x, z, width, depth, thickness, resistor=False):
    batch.box((x, TOP+thickness/2, z), (width, thickness, depth),
              mats["mold"] if resistor else mats["ceramic"], .007)
    for sign in (-1, 1):
        batch.box((x+sign*width*.39, TOP+thickness/2, z),
                  (width*.24, thickness+.003, depth+.004), mats["tin"], 0)


def small_details(root, mats):
    parts = MeshBatch()
    caps = [(-.215,-1.865), (-.202,-1.775), (.342,-1.856), (.435,-.925), (.584,-.973), (.698,-1.026),
            (-.538,-.537), (-.534,-.736), (-.508,-.322), (.425,-.005), (.584,.046), (.589,-.071),
            (-.197,.653), (-.112,.719), (-.013,.552), (.074,.552), (.443,.186), (-.231,1.059), (-.381,.921)]
    caps += [(-.072 + i*.086, -.460) for i in range(9)]
    for i, (x,z) in enumerate(caps):
        chip_part(parts, mats, x, z, .076 if i%4==0 else .061, .048, .026, resistor=i%3==0)
    for x, z in [(-.52,-1.495), (-.18,-1.495), (-.52,-1.205), (-.18,-1.205),
                 (-.64,-2.07), (-.50,-2.07)]:
        parts.box((x, TOP+.002, z), (.060, .005, .073), mats["tin"], 0)
    parts.finish("PICO_FIXED_PASSIVES_AND_CONTROL_LANDS", root)


def masked_route(batch, coords, y, width, mat, underside=False):
    segments = []
    for (x,z), (nx,nz) in zip(coords, coords[1:]):
        dx, dz = nx-x, nz-z
        length = math.hypot(dx,dz)
        segments.append((-dz/length,dx/length))
    vertices = []
    for index, (x,z) in enumerate(coords):
        a, b = segments[max(0,index-1)], segments[min(index,len(segments)-1)]
        miter = width/(2*(1+a[0]*b[0]+a[1]*b[1]))
        dx, dz = (a[0]+b[0])*miter, (a[1]+b[1])*miter
        vertices.extend([(x+dx,y,z+dz),(x-dx,y,z-dz)])
    faces = [(i,i+2,i+3,i+1) for i in range(0,len(vertices)-2,2)]
    batch.add(vertices, [tuple(reversed(face)) for face in faces] if underside else faces, mat)


def pcb_artwork(root, mats):
    traces = MeshBatch()
    for side in (-1, 1):
        for i in range(20):
            z = (i-9.5)*PITCH
            target_z = .05+(i-9.5)*.038
            turn = .73-(i%5)*.043
            # The two groups fan around the package. Top traces and lower fan-out
            # are surface illustrations, not exported design copper.
            if i in (2,7,12,17):
                continue
            start = (side*.798,z)
            end = (side*(.377+(i%3)*.014),target_z)
            turn_z = z + (target_z-z)*.38
            route = [start,(side*turn,turn_z),(side*(turn-.060),target_z),end]
            underside = i%3 == 0
            # Different planes for separate traces prevent coplanar edge artifacts.
            y = BASE-.002-i*.000022 if underside else TOP+.0018+i*.000022
            masked_route(traces,route,y,.011,mats["trace_back" if underside else "trace"],underside)
            if i%2 == 0:
                rims = [(.026,y+.0003),(.010,y+.0003)]
                ring(traces,side*turn,turn_z,rims if underside else rims[::-1],
                     mats["trace_back" if underside else "via"],12)
    for x,z,r in [(-.59,-1.93,.058),(.47,1.96,.061),(.30,-2.18,.027),(-.11,1.25,.027)]:
        traces.cylindrical(x,z,[(r,TOP+.001),(r,TOP+.003)],mats["gold"],20,True)
    traces.finish("PICO_ILLUSTRATIVE_COPPER_AND_TEST_PADS", root, closed=False)


def studio():
    scene = bpy.context.scene
    ground = MeshBatch()
    ground.box((0,.008,0),(60,.015,60),material("Studio ground", "cdd9d9", 0, .75),0)
    ground.finish("Evidence ground").hide_set(True)
    scene.world = bpy.data.worlds.new("Studio ambient")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.57,.65,.72,1)
    background.inputs["Strength"].default_value = .43
    center = (0,.31,-.15)
    for name, point, watts, size in [("Key",(-3,6,-5),760,5), ("Fill",(5,5,1),455,5), ("Rim",(0,4,5),590,5)]:
        lamp = bpy.data.lights.new(name,"AREA")
        lamp.energy,lamp.shape,lamp.size = watts,"DISK",size
        obj = bpy.data.objects.new(name,lamp)
        bpy.context.collection.objects.link(obj)
        obj.location = blender_point(point)
        aim(obj,blender_point(center))
        obj.hide_set(True)
    camera = bpy.data.cameras.new("Studio camera")
    camera.type,camera.ortho_scale = "ORTHO",6.25
    obj = bpy.data.objects.new("Studio camera",camera)
    bpy.context.collection.objects.link(obj)
    obj.location = blender_point((4.0,8.9,-7.9))
    aim(obj,blender_point(center))
    scene.camera = obj
    obj.hide_set(True)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                view = area.spaces.active.region_3d
                view.view_location = Vector(blender_point(center))
                view.view_rotation = obj.rotation_euler.to_quaternion()
                view.view_distance = 6.7
                view.view_perspective = "ORTHO"
                area.spaces.active.shading.color_type = "MATERIAL"
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 1000
    scene.render.image_settings.file_format = "PNG"
    return scene


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--blend", type=Path)
    parser.add_argument("--render", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {name:material(name,color,metal,roughness) for name,color,metal,roughness in [
        ("mask","0d6d47",.04,.52),("edge","8b8350",.09,.59),("core","b3a45e",.07,.61),
        ("gold","d6ab5a",.71,.34),("tin","b5c0c1",.72,.34),("steel","b4bdc0",.82,.29),
        ("dark_steel","65716c",.65,.43),("mold","25282a",.03,.56),("mark","606564",.05,.52),
        ("ceramic","bda27c",.10,.54),("dielectric","333a37",.04,.60),("inductor","424643",.09,.58),
        ("trace","33875d",.11,.50),("trace_back","237752",.10,.52),("via","2e654b",.18,.52),
    ]}
    root = empty("PICO_COMMON")
    root["Variant"] = "Original Raspberry Pi Pico Rev3, RP2040, USB up, no presoldered headers"
    root["Mechanical drawing"] = DATASHEET
    root["Placement reference"] = STEP
    root["Units"] = "Numeric centimetres, Y up, USB faces -Z"
    root["Geometry"] = "Blender reconstruction referencing the Raspberry Pi mechanical design. Traces, small packages and connector interior are illustrative."
    routed_board(root,mats)
    contacts(root,GPIO,False,"PICO_GPIO_PLATING",mats["gold"])
    contacts(root,SWD,True,"PICO_SWD_PLATING",mats["gold"])
    mounting_rings(root,mats)
    micro_usb(root,mats)
    devices(root,mats)
    small_details(root,mats)
    pcb_artwork(root,mats)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()),export_format="GLB",export_yup=True,export_extras=True)
    if args.blend or args.render:
        scene = studio()
    if args.blend:
        bpy.context.preferences.filepaths.save_version = 0
        args.blend.parent.mkdir(parents=True,exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()))
    if args.render:
        args.render.parent.mkdir(parents=True,exist_ok=True)
        scene.render.filepath = str(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
