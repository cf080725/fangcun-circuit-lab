"""Make the Arduino UNO R3 DIP fixed assembly with Blender 4.5 LTS.

Supply the official A000066 CAD archive or its extracted UNO-TH_Rev3e.brd.

  blender -b -P tools/blender/uno_r3.py -- --cad A000066-cad-files.zip --output dist/models/uno-r3-detail.glb

Optional --blend and --render paths save the editable scene and its studio view.
The numeric GLB units are centimetres, +Y up, and the connector mouths face -Z.
The fixed assembly includes housing, contacts and PCB. Reset, dynamic LEDs
and screen ink are added by the workbench.

The outline, drilled holes, connector/part locations and routed copper are
adapted from Arduino UNO-TH Rev3e CAD for product A000066 by Arduino SA.
The CAD-derived geometry is licensed CC BY-SA 4.0 and adapted here to a
visual Blender mesh. Package exteriors, socket internals, connector shell
heights, metallic fillets and the studio scene are illustrative.

https://docs.arduino.cc/hardware/uno-rev3/
https://docs.arduino.cc/static/6bb7a3ca51ebee82a252f60c0b418787/A000066-cad-files.zip
https://creativecommons.org/licenses/by-sa/4.0/
"""

import argparse
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material


TOP, BOTTOM = .35, .21
SOURCE = "https://docs.arduino.cc/static/6bb7a3ca51ebee82a252f60c0b418787/A000066-cad-files.zip"
LICENSE = "https://creativecommons.org/licenses/by-sa/4.0/"
FEMALE = ("POWER", "AD", "IOH", "IOL")
ICSP = ("ICSP", "ICSP1")


def board_point(x, y):
    return ((y - 26.67) / 10, (x - 34.29) / 10)


def read_board(path):
    if path.suffix.lower() == ".zip":
        with ZipFile(path) as archive:
            board = next(name for name in archive.namelist() if name.endswith("/UNO-TH_Rev3e.brd"))
            return ET.fromstring(archive.read(board)).find(".//board")
    return ET.parse(path).find(".//board")


def transform_element(element, local_x=0, local_y=0):
    orientation = element.get("rot", "R0")
    angle = math.radians(float(orientation.rsplit("R", 1)[-1]))
    if "M" in orientation:
        local_x = -local_x
    x = float(element.get("x")) + math.cos(angle)*local_x - math.sin(angle)*local_y
    y = float(element.get("y")) + math.sin(angle)*local_x + math.cos(angle)*local_y
    return board_point(x, y)


def package_pads(cad, element):
    library, name = element.get("library"), element.get("package")
    package = cad.find(f'libraries/library[@name="{library}"]/packages/package[@name="{name}"]')
    return [(pad.get("name"), *transform_element(element, float(pad.get("x")), float(pad.get("y"))),
             float(pad.get("drill")) / 20) for pad in package.findall("pad")]


def cad_wires(wire):
    x0, y0, x1, y1 = [float(wire.get(key)) for key in ("x1", "y1", "x2", "y2")]
    sweep = math.radians(float(wire.get("curve", "0")))
    if not sweep:
        return [(x0, y0), (x1, y1)]
    offset = 1 / (2 * math.tan(sweep / 2))
    cx, cy = (x0+x1)/2 - (y1-y0)*offset, (y0+y1)/2 + (x1-x0)*offset
    radius = math.hypot(x0-cx, y0-cy)
    start = math.atan2(y0-cy, x0-cx)
    arc = [(cx+radius*math.cos(start+sweep*i/8), cy+radius*math.sin(start+sweep*i/8)) for i in range(1, 8)]
    return [(x0, y0), *arc, (x1, y1)]


def outline(cad):
    wires = [cad_wires(wire) for wire in cad.findall('plain/wire[@layer="20"]')]
    result = wires.pop(0)
    while wires:
        match = next(index for index, edge in enumerate(wires) if result[-1] in (edge[0], edge[-1]))
        segment = wires.pop(match)
        if segment[-1] == result[-1]:
            segment.reverse()
        result.extend(segment[1:])
    if result[-1] != result[0]:
        raise ValueError("Arduino dimension layer is not a closed contour")
    return [board_point(x, y) for x, y in result[:-1]]


def board_mesh(cad, root, mats, contacts):
    edge = outline(cad)
    count = len(edge)
    surfaces = [BOTTOM, BOTTOM+.006, TOP-.006, TOP]
    pcb = MeshBatch()
    pcb.add([(x,y,z) for y in surfaces for x,z in edge],
            [tuple(reversed(range(count))), *loops_faces(count,4), tuple(range(count*3,count*4))],mats["mask"])
    pcb.materials.append(mats["fr4"])
    pcb.indices[1+count:1+2*count] = [1]*count
    body = pcb.finish("UNO_PCB_MASK_AND_LAMINATE", root)
    tools = MeshBatch()
    mount_holes = [(*board_point(float(hole.get("x")), float(hole.get("y"))), float(hole.get("drill"))/20)
                   for hole in cad.findall("plain/hole")]
    for x,z,radius in [*mount_holes, *contacts]:
        tools.cylindrical(x,z,[(radius,BOTTOM-.05),(radius,TOP+.05)],mats["mask"],segments=20,caps=True)
    cut_mesh(body, tools.finish("Temporary official Eagle drills"))
    annuli = MeshBatch()
    for x,z,radius in mount_holes:
        annuli.cylindrical(x,z,[(radius,BOTTOM-.002),(radius+.048,BOTTOM-.002),
                              (radius+.048,BOTTOM+.002)],mats["rim"],segments=28)
        annuli.cylindrical(x,z,[(radius+.048,TOP-.002),(radius+.048,TOP+.002),
                              (radius,TOP+.002)],mats["rim"],segments=28)
    annuli.finish("UNO_MOUNTING_HOLE_RIMS",root,closed=False)
    pads = MeshBatch()
    for x,z,radius in contacts:
        outer = radius+.025
        pads.cylindrical(x,z,[(radius*.91,BOTTOM-.004),(outer,BOTTOM-.004),
                             (outer,BOTTOM+.001),(radius,BOTTOM+.001),(radius,TOP-.001),
                             (outer,TOP-.001),(outer,TOP+.004),(radius*.91,TOP+.004),
                             (radius*.91,BOTTOM-.004)],mats["tin"],segments=12)
    pads.finish("UNO_PLATED_THROUGH_HOLE_ANNULI",root,closed=False)


def copper(cad, root, mats):
    routes = MeshBatch()
    for wire in cad.findall("signals/signal/wire"):
        layer=wire.get("layer")
        if layer not in ("1","16"):
            continue
        front=layer=="1"
        points=[board_point(x,y) for x,y in cad_wires(wire)]
        routes.ribbon(points, TOP+.0008 if front else BOTTOM-.005, float(wire.get("width"))/10,
                      mats["trace"] if front else mats["trace_bottom"])
    routes.finish("UNO_MASKED_CAD_TRACES",root,closed=False)
    vias = MeshBatch()
    for via in cad.findall("signals/signal/via"):
        x,z=board_point(float(via.get("x")),float(via.get("y")))
        radius=float(via.get("drill"))/20+.014
        vias.cylindrical(x,z,[(radius,TOP+.0009),(radius,TOP+.002)],mats["via"],segments=12,caps=True)
    vias.finish("UNO_TENTED_VIAS",root)


def rectangular_port(x,z,y0,y1,opening_width,outer_width):
    outer=[(-1,-1),(1,-1),(1,1),(-1,1)]
    loops = [(outer_width,y0),(outer_width,y1),(opening_width+.027,y1),
             (opening_width,y1-.022),(opening_width,y0)]
    vertices=[(x+dx*width/2,y,z+dz*width/2) for width,y in loops for dx,dz in outer]
    return vertices,[*loops_faces(4,len(loops)),*[(16+i,16+(i+1)%4,(i+1)%4,i) for i in range(4)]]


def headers(by_name, root, mats):
    houses, contacts, blocks, posts = (MeshBatch() for _ in range(4))
    for name in FEMALE:
        for _,x,z,_ in by_name[name]:
            vertices,faces=rectangular_port(x,z,TOP+.005,1.20,.102,.252)
            houses.add(vertices,faces,mats["plastic"])
            for sign in [-1,1]:
                contacts.box((x+sign*.044,.858,z),(.014,.259,.067),mats["pin_tin"],0)
                contacts.box((x+sign*.042,.980,z),(.026,.023,.045),mats["pin_tin"],.003)
    houses.finish("UNO_FEMALE_SOCKET_HOUSINGS",root)
    contacts.finish("UNO_FEMALE_SOCKET_CONTACTS",root)
    for name in ICSP:
        for _,x,z,_ in by_name[name]:
            blocks.box((x,.455,z),(.249,.21,.249),mats["plastic"],.009)
            posts.box((x,.7825,z),(.061,.485,.061),mats["gold"],.010)
    blocks.finish("UNO_ICSP_HOUSINGS",root)
    posts.finish("UNO_ICSP_POSTS",root)


def usb_b(root, mats, x, front, back):
    shell = MeshBatch()
    outer=[(-.590,.36),(.590,.36),(.590,1.30),(.413,1.49),(-.413,1.49),(-.590,1.30)]
    inner=[(-.545,.404),(.545,.404),(.545,1.279),(.390,1.447),(-.390,1.447),(-.545,1.279)]
    rings=[(outer,front),(outer,back),(inner,back),(inner,front)]
    vertices=[(x+dx,y,z) for polygon,z in rings for dx,y in polygon]
    n=len(outer)
    shell.add(vertices,[*loops_faces(n,4),*[(3*n+i,3*n+(i+1)%n,(i+1)%n,i) for i in range(n)]],mats["steel"])
    for dx in [-.30,.30]:
        shell.box((x+dx,1.483,front+.43),(.116,.029,.21),mats["steel_light"],.008)
    for dx in [-.59,.59]:
        shell.box((x+dx,.549,back-.45),(.076,.294,.39),mats["steel_dark"],.010)
    shell.finish("UNO_USB_B_OPEN_SHELL",root)

    insert=MeshBatch()
    insert.box((x,.936,back-.031),(.999,1.046,.137),mats["usb"],.019)
    insert.box((x,.871,(front+back)/2+.115),(.519,.393,back-front-.371),mats["usb"],.020)
    for dx in [-.14,.14]:
        for y in [.662,1.079]:
            insert.box((x+dx,y,front+.470),(.066,.025,.378),mats["gold"],.004)
    insert.finish("UNO_USB_B_DIELECTRIC_AND_FOUR_CONTACTS",root)


def axial_z(batch,x,y,sections,mat,segments=28,caps=True):
    vertices=[(x+r*math.cos(i*math.tau/segments),y+r*math.sin(i*math.tau/segments),z)
              for r,z in sections for i in range(segments)]
    faces=loops_faces(segments,len(sections))
    if caps:
        faces.extend([tuple(reversed(range(segments))),
                      tuple(range(len(vertices)-segments,len(vertices)))])
    batch.add(vertices,faces,mat,smooth=not caps)


def barrel(root,mats,x,front,back,width):
    housing=MeshBatch()
    height=1.046
    housing.box((x,TOP+height/2,(front+back)/2),(width,height,back-front),mats["plastic"],.040)
    body=housing.finish("UNO_BARREL_OPEN_JACK",root)
    bore=MeshBatch()
    center_y=.856
    axial_z(bore,x,center_y,[(.334,front-.08),(.334,front+.026),
                            (.290,front+.105),(.290,back-.258)],mats["plastic"])
    cut_mesh(body,bore.finish("Temporary 5.5 mm barrel bore"))
    center=MeshBatch()
    axial_z(center,x,center_y,[(.074,front+.239),(.103,front+.290),(.103,back-.270)],mats["pin_tin"])
    axial_z(center,x,center_y,[(.291,front+.130),(.291,back-.292)],mats["steel_dark"],caps=False)
    center.finish("UNO_BARREL_INNER_SLEEVE_AND_CENTER_CONTACT",root)


def dip328(root,mats,pads,center):
    x,z=center
    socket=MeshBatch()
    for _,px,pz,_ in pads:
        vertices,faces=rectangular_port(px,pz,TOP+.007,.775,.065,.198)
        socket.add(vertices,faces,mats["plastic"])
    for side in [-1,1]:
        socket.box((x,.487,z+side*1.620),(.731,.230,.271),mats["plastic"],.023)
    socket.finish("UNO_DIP_SOCKET",root)
    package=MeshBatch()
    package.loft([(.788,.604,3.620,.039),(.822,.637,3.708,.051),
                  (1.093,.635,3.701,.046),(1.126,.594,3.647,.038)],mats["mold"],center)
    body=package.finish("UNO_DIP_BODY",root)
    notch=MeshBatch()
    notch.cylindrical(x,z+1.838,[(.117,1.017),(.117,1.173)],mats["mold"],segments=32,caps=True)
    cut_mesh(body,notch.finish("Temporary DIP orientation notch"))
    mark=MeshBatch()
    mark.cylindrical(x+.218,z+1.566,[(.031,1.126),(.031,1.129)],mats["mark"],caps=True)
    mark.finish("UNO_DIP_PIN_ONE",root)
    legs=MeshBatch()
    for _,px,pz,_ in pads:
        side=1 if px>x else -1
        cross=[(.299,.928),(.350,.928),(.385,.898),(.386,.764),
               (.351,.764),(.349,.877),(.331,.902),(.299,.902)]
        n=len(cross)
        vertices=[(x+side*dx,y,pz+dz) for dz in [-.024,.024] for dx,y in cross]
        legs.add(vertices,[tuple(reversed(range(n))),*loops_faces(n,2),tuple(range(n,n*2))],mats["pin_tin"])
    legs.finish("UNO_DIP_28_FORMED_LEADS",root)


def usb_bridge(cad,elements,root,mats):
    element=elements["U3"]
    x,z=transform_element(element)
    body=MeshBatch()
    body.loft([(.370,.476,.476,.021),(.391,.50,.50,.027),(.451,.482,.482,.023)],mats["mold"],(x,z))
    body.finish("UNO_USB_BRIDGE_QFN32_BODY",root)
    pkg=cad.find('libraries/library[@name="SmartPrj"]/packages/package[@name="MLF32"]')
    contacts=MeshBatch()
    for smd in pkg.findall("smd"):
        if smd.get("layer")!="1" or not smd.get("name").isdigit():
            continue
        px,pz=transform_element(element,float(smd.get("x")),float(smd.get("y")))
        w,d=float(smd.get("dx"))/10,float(smd.get("dy"))/10
        contacts.box((px,.363,pz),(w,.024,d),mats["pin_tin"],0)
    contacts.cylindrical(x+.171,z+.17,[(.022,.451),(.022,.454)],mats["mark"],segments=16,caps=True)
    contacts.finish("UNO_USB_BRIDGE_32_CONTACTS_AND_MARK",root)


def passives(elements, root, mats):
    parts = MeshBatch()
    for name,e in elements.items():
        package=e.get("package")
        x,z=transform_element(e)
        if name in ("ON","L","RESET","X1","X2","ZU4","U3") or name in FEMALE+ICSP:
            continue
        if package in ("C0603-ROUND","R0603-ROUND","CT/CN0603","0805","L1812","MINIMELF","SMB","CAY16","CHIP-LED0805","RESONATOR"):
            widths={"0805":(.20,.125),"L1812":(.46,.33),"MINIMELF":(.29,.14),"SMB":(.46,.32),
                    "CAY16":(.32,.16),"CHIP-LED0805":(.20,.124),"RESONATOR":(.32,.16)}
            width,depth=widths.get(package,(.16,.084))
            angle=math.radians(90+float(e.get("rot","R0").rsplit("R",1)[-1]))
            mid=mats["ceramic"] if name.startswith("C") else mats["mold"]
            if name in ("RX","TX"):
                mid=mats["led"]
            elif name=="F1":
                mid=mats["fuse"]
            parts.box((x,.390,z),(width*.78,.057,depth),mid,.010,angle)
            for sign in [-1,1]:
                delta=sign*width*.39
                parts.box((x+math.cos(angle)*delta,.370,z-math.sin(angle)*delta),
                          (width*.25,.026,depth+.016),mats["tin"],.004,angle)
        if package=="PANASONIC_D":
            parts.box((x,.395,z),(.645,.090,.645),mats["plastic"],.029)
            parts.cylindrical(x,z,[(.270,.423),(.305,.446),(.310,.899),(.290,.926)],
                              mats["steel"],segments=36,caps=True)
            parts.box((x,.928,z),(.355,.006,.019),mats["steel_dark"],0,math.pi/4)
            parts.box((x,.929,z),(.355,.006,.019),mats["steel_dark"],0,-math.pi/4)
        if package=="QS":
            parts.loft([(.354,.412,.650,.192),(.377,.438,.689,.204),
                        (.517,.416,.663,.195),(.538,.374,.615,.177)],mats["steel"],(x,z))
        if package in ("SOT223","SOT-23","SOT23-DBV","MSOP08"):
            width,depth,lead_count={"SOT223":(.36,.65,3),"SOT-23":(.19,.29,3),
                                    "SOT23-DBV":(.19,.29,5),"MSOP08":(.31,.32,8)}[package]
            parts.box((x,.414,z),(width,.102,depth),mats["mold"],.013)
            for index in range(lead_count):
                side=-1 if index%2==0 else 1
                parts.box((x+side*(width/2+.042),.367,z+(index//2-(lead_count//2-1)/2)*.086),
                          (.106,.024,.041),mats["tin"],.004)
            if package=="SOT223":
                parts.box((x-.20,.362,z),(.204,.023,.31),mats["tin"],.006)
    parts.finish("UNO_SMD_CLOCK_AND_POWER_PACKAGES",root)


def bottom_solder(root,mats,contacts):
    solder=MeshBatch()
    for x,z,radius in contacts:
        outer=radius+.016
        solder.cylindrical(x,z,[(radius*.47,BOTTOM-.129),(radius*.60,BOTTOM-.116),
                                 (radius*.64,BOTTOM-.063),(outer*.78,BOTTOM-.026),
                                 (outer,BOTTOM-.007),(outer*.93,BOTTOM+.001)],
                           mats["tin"],segments=12,caps=True)
    solder.finish("UNO_UNDERSIDE_PINS_AND_SOLDER",root)


def studio():
    from mathutils import Vector

    stage=MeshBatch()
    stage.box((0,.008,0),(150,.015,150),material("Evidence backdrop","cdd8db",roughness=.73),0)
    stage.finish("Evidence ground").hide_set(True)
    scene=bpy.context.scene
    scene.world=bpy.data.worlds.new("Evidence world")
    scene.world.use_nodes=True
    background=scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value=(.56,.65,.73,1)
    background.inputs["Strength"].default_value=.44
    for name,point,energy,size in [("Key",(-5,7,-6),990,6),("Fill",(7,5,2),500,5),("Rim",(-4,6,6),880,5)]:
        light=bpy.data.lights.new(name,"AREA")
        light.energy,light.shape,light.size=energy,"DISK",size
        obj=bpy.data.objects.new(name,light)
        bpy.context.collection.objects.link(obj)
        obj.location=blender_point(point)
        aim(obj,blender_point((0,.35,-.25)))
        obj.hide_set(True)
    camera=bpy.data.cameras.new("Studio camera")
    camera.type,camera.ortho_scale="ORTHO",10.1
    obj=bpy.data.objects.new("Studio camera",camera)
    bpy.context.collection.objects.link(obj)
    obj.location=blender_point((6.2,10.6,-7.9))
    aim(obj,blender_point((0,.40,-.24)))
    scene.camera=obj
    obj.hide_set(True)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=="VIEW_3D":
                region=area.spaces.active.region_3d
                region.view_location=Vector(blender_point((0,.39,-.24)))
                region.view_rotation=obj.rotation_euler.to_quaternion()
                region.view_distance=10
                region.view_perspective="ORTHO"
                area.spaces.active.shading.color_type="MATERIAL"
    scene.render.engine="CYCLES"
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.resolution_x,scene.render.resolution_y=1100,1100
    scene.render.image_settings.file_format="PNG"
    return scene


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cad",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--blend",type=Path)
    parser.add_argument("--render",type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    cad=read_board(args.cad)
    elements={e.get("name"):e for e in cad.findall("elements/element")}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats={
        "mask":material("Arduino style blue solder mask","087c96",.04,.39),
        "fr4":material("Board edge glass laminate","9d8b52",.11,.68),
        "rim":material("Exposed mounting hole ring","c1c9c7",.75,.40),
        "trace":material("Top copper under solder mask","0d8499",.10,.43),
        "trace_bottom":material("Bottom copper under solder mask","106a82",.09,.46),
        "via":material("Masked via barrel","0a6478",.12,.43),
        "tin":material("Solder meniscus and through-hole plating","b8c3c6",.73,.29),
        "pin_tin":material("Stamped tin plated terminals","bcc6c6",.86,.28),
        "gold":material("Connector gold terminals","d1a958",.83,.27),
        "steel":material("Brushed USB and capacitor metal","aab6ba",.91,.27),
        "steel_light":material("Rolled connector steel","d8ddde",.86,.23),
        "steel_dark":material("Recessed contacts and metal marks","657277",.76,.46),
        "usb":material("USB dielectric tongue","c4c1af",0,.53),
        "plastic":material("Molded connector thermoplastic","24282a",.03,.69),
        "mold":material("Matte black semiconductor molding","22282c",.03,.56),
        "mark":material("Recessed orientation mark","515758",.06,.61),
        "ceramic":material("SMD ceramic dielectric","b49a6b",.14,.53),
        "led":material("Serial LED amber encapsulation","d3ab55",.08,.42),
        "fuse":material("USB resettable fuse","a7a24b",.06,.60),
    }
    root=empty("UNO_COMMON")
    root["CAD"] = "Arduino SA A000066 UNO-TH Rev3e"
    root["CAD URL"] = SOURCE
    root["CAD license"] = LICENSE
    root["Adaptation"] = "CAD outline, placements, drills and copper adapted to Blender mesh; component exteriors illustrative."
    root["Units"] = "Numeric centimetres, Y up, connector mouths face -Z"
    bpy.context.scene["CAD source"] = SOURCE
    bpy.context.scene["CAD license"] = LICENSE
    bpy.context.scene["Credit"] = "Arduino SA UNO-TH Rev3e, adapted to Blender geometry."
    names=FEMALE+ICSP+("ZU4","X2","X1","Y1")
    by_name={name:package_pads(cad,elements[name]) for name in names}
    contacts=[(x,z,radius) for name in names for pin,x,z,radius in by_name[name]
              if name!="X1" or pin in ("1","2","3")]
    board_mesh(cad,root,mats,contacts)
    copper(cad,root,mats)
    headers(by_name,root,mats)
    usb_x,usb_front=transform_element(elements["X2"],0,-10.15)
    _,usb_back=transform_element(elements["X2"],0,5.60)
    usb_b(root,mats,usb_x,usb_front,usb_back)
    barrel_x,barrel_front=transform_element(elements["X1"],(-5.08+3.9116)/2,7.1374)
    _,barrel_back=transform_element(elements["X1"],0,-6.35)
    barrel(root,mats,barrel_x,barrel_front,barrel_back,.89916)
    dip328(root,mats,by_name["ZU4"],transform_element(elements["ZU4"]))
    usb_bridge(cad,elements,root,mats)
    passives(elements,root,mats)
    bottom_solder(root,mats,contacts)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()),export_format="GLB",
                              export_yup=True,export_extras=True)
    scene=studio() if args.blend or args.render else None
    if args.blend:
        args.blend.parent.mkdir(parents=True,exist_ok=True)
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()),compress=True)
    if args.render:
        args.render.parent.mkdir(parents=True,exist_ok=True)
        scene.render.filepath=str(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
