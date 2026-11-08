"""Build the Seeed Grove Relay v1.2 assembly in Blender 4.5 LTS.

blender -b -t 6 -P tools/blender/relay_grove_v12.py -- --output dist/models/grove-relay-v12.glb

PCB outline, drill pattern and placements use Seeed's published v1.2 Eagle
board. The black shell follows the HLS8-T73 outline and the v1.2 photo's
HLS8L-DC3V-S-C marking. Connector height, screw cage finish and minor plastic
details are interpreted. This model depicts the exterior and exposed contacts.

https://wiki.seeedstudio.com/Grove-Relay/
https://github.com/SeeedDocument/Grove-Relay/tree/master/res
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material, rotate


REFERENCE = "https://wiki.seeedstudio.com/Grove-Relay/"
CAD = "https://raw.githubusercontent.com/SeeedDocument/Grove-Relay/master/res/Grove-Relay_Eagle_Files.zip"
DATASHEET = "https://raw.githubusercontent.com/SeeedDocument/Grove-Relay/master/res/Relay_Datasheet.pdf"
BASE, TOP = .190, .350
J2_X, J2_PIN_TOP = -1.64846, .860
J2 = [("SIG",.300),("NC_UNUSED",.100),("VCC",-.100),("GND",-.300)]
J1_Z, J1_FRONT, J1_ENTRY_Y = .4445, .8255, .680
J1 = [("COM",-1.0033),("NO",-.6477)]
CASE_X, CASE_Z, CASE_BASE, CASE_HEIGHT = .7366, -.00635, .376, 1.580
D3_X, D3_Z, D3_TOP = -1.143, -.6858, .415
MOUNT = [(-1,-1),(-1,1),(2,0)]
RELAY_PADS = [(x,-y) for x,y in [(1.651,6.1595),(13.843,6.1595),(1.651,-6.0325),
                                     (13.843,-6.0325),(-.889,.0635)]]

# Connected vertices of the Eagle Dimension layer, before converting mm to cm.
# The third entry is the signed arc angle to the next vertex.
OUTLINE = [(-19.2,10,90),(-20,9.2,0),(-20,2.7,90),(-19.7,2.4,-165.749967),
           (-19.7,-2.4,90),(-20,-2.7,0),(-20,-9.2,90),(-19.2,-10,0),
           (-12.1,-10,-90),(-11.9,-10.2,167.981988),(-8.1,-10.2,-90),(-7.9,-10,0),
           (7.3,-10,90),(7.6,-9.7,-165.749967),(12.4,-9.7,90),(12.7,-10,0),
           (19.2,-10,90),(20,-9.2,0),(20,-2.1,-90),(20.2,-1.9,167.981988),
           (20.2,1.9,-90),(20,2.1,0),(20,9.2,90),(19.2,10,0),
           (12.7,10,90),(12.4,9.7,-165.749967),(7.6,9.7,90),(7.3,10,0),
           (-7.8,10,-90),(-8.1,10.3,162.054747),(-11.9,10.3,-90),(-12.2,10,0)]


def outline():
    for (x,y,arc),(next_x,next_y,_) in zip(OUTLINE,OUTLINE[1:]+OUTLINE[:1]):
        if not arc:
            yield x/10,-y/10
            continue
        turn = math.radians(arc)
        offset = .5/math.tan(turn/2)
        cx = (x+next_x)/2-(next_y-y)*offset
        cy = (y+next_y)/2+(next_x-x)*offset
        radius = math.hypot(x-cx,y-cy)
        start = math.atan2(y-cy,x-cx)
        steps = math.ceil(abs(arc)/9)
        for i in range(steps):
            angle = start+turn*i/steps
            yield (cx+radius*math.cos(angle))/10,-(cy+radius*math.sin(angle))/10


def board(parent,mats):
    plate = MeshBatch()
    points = list(outline())
    count = len(points)
    plate.add([(x,y,z) for y in (BASE,TOP) for x,z in points],
              [tuple(reversed(range(count))),*loops_faces(count,2),tuple(range(count,2*count))],mats["mask"])
    plate.materials.append(mats["laminate"])
    plate.indices[1:count+1] = [1]*count
    pcb = plate.finish("GROVE_RELAY_PCB",parent)
    pads = [(J2_X,z,.040,.0635) for _,z in J2] + [(x,J1_Z,.0508,.1016) for _,x in J1]
    pads += [(x/10,z/10,.0635,.109) for x,z in RELAY_PADS]
    holes = [(x,z,drill) for x,z,drill,_ in pads] + [(x,z,.110) for x,z in MOUNT]
    drill = MeshBatch()
    for x,z,radius in holes:
        drill.cylindrical(x,z,[(radius,BASE-.050),(radius,TOP+.050)],mats["tin"],28,True)
    cut_mesh(pcb,drill.finish("Eagle drilled bores"))
    pads_mesh = MeshBatch()
    for x,z,drill,outer in pads:
        inner = drill-.001
        pads_mesh.cylindrical(x,z,[(inner,BASE-.004),(outer,BASE-.004),(outer,BASE),
                                   (inner,BASE),(inner,TOP),(outer,TOP),(outer,TOP+.003),
                                   (inner,TOP+.003),(inner,BASE-.004)],mats["tin"],24)
    pads_mesh.finish("GROVE_RELAY_PLATED_PADS",parent,closed=False)

    solder = MeshBatch()
    for x,z,_,outer in pads:
        solder.cylindrical(x,z,[(.021,BASE-.052),(outer*.84,BASE-.022),
                                 (outer*.95,BASE-.004)],mats["tin"],18,True)
    for x in (-1.8415,1.8415):
        for z in (-.635,-.381,.381,.635):
            solder.cylindrical(x,z,[(.076,BASE-.002),(.076,BASE+.0002)],mats["tin"],20,True)
    solder.finish("GROVE_RELAY_REAR_SOLDER_AND_TEST_PADS",parent)


def grove(parent,mats):
    shell = MeshBatch()
    shell.box((J2_X-.014,.655,0),(.500,.606,.990),mats["nylon"],.026)
    socket = shell.finish("GROVE_RELAY_J2_KEYED_HOUSING",parent)
    recess = MeshBatch()
    recess.box((J2_X,.804,0),(.346,.416,.793),mats["nylon"],.024)
    cut_mesh(socket,recess.finish("J2 four-pole cavity"))
    key = MeshBatch()
    key.box((J2_X-.206,.862,0),(.192,.223,.354),mats["nylon"],.010)
    cut_mesh(socket,key.finish("J2 keyed mouth"))
    ribs = MeshBatch()
    for z in (-.371,.371):
        ribs.box((J2_X-.231,.864,z),(.090,.181,.107),mats["nylon"],.011)
    for z in (-.20,0,.20):
        ribs.box((J2_X+.113,.601,z),(.096,.125,.025),mats["nylon"],.005)
    ribs.finish("GROVE_RELAY_J2_LATCH_GUIDES",parent)
    for name,z in J2:
        metal = MeshBatch()
        metal.box((J2_X,.640,z),(.046,.440,.046),mats["tin"],.005)
        label = "GROVE_RELAY_NC_UNUSED" if name=="NC_UNUSED" else "GROVE_RELAY_CONTACT_"+name
        contact = metal.finish(label,parent)
        contact["Endpoint"] = [J2_X,J2_PIN_TOP,z]


def front_cylinder(batch,x,y,sections,mat,segments=32):
    """Extrude a round profile around the +Z wire-entry axis."""
    rings = [[(x+radius*math.cos(a),y+radius*math.sin(a),z)
              for i in range(segments) for a in [i*math.tau/segments]] for z,radius in sections]
    end = segments*len(rings)
    batch.add([point for ring in rings for point in ring],
              [tuple(reversed(range(segments))),*loops_faces(segments,len(rings)),
               tuple(range(end-segments,end))],mat)


def screws(parent,mats):
    housing = MeshBatch()
    housing.box((-.8255,.717,J1_Z),(.762,.734,.762),mats["green"],.017)
    block = housing.finish("GROVE_RELAY_J1_GREEN_BLOCK",parent)
    voids = MeshBatch()
    for _,x in J1:
        voids.cylindrical(x,J1_Z,[(.140,.911),(.147,1.113)],mats["green"],32,True)
        front_cylinder(voids,x,J1_ENTRY_Y,[(.505,.112),(.850,.122)],mats["green"])
    cut_mesh(block,voids.finish("J1 screw and wire bores"))

    separators = MeshBatch()
    for x in (-1.207,-.8255,-.444):
        separators.box((x,.707,J1_FRONT-.023),(.017,.662,.052),mats["green"],.005)
    separators.finish("GROVE_RELAY_J1_MOULDED_DIVIDERS",parent)
    for name,x in J1:
        contact = empty("GROVE_RELAY_CONTACT_"+name)
        contact.parent = parent
        contact["Endpoint"] = [x,J1_ENTRY_Y,J1_FRONT]
        cage = MeshBatch()
        for side in (-1,1):
            cage.box((x+side*.072,J1_ENTRY_Y,.688),(.035,.119,.241),mats["tin"],.006)
            cage.box((x,J1_ENTRY_Y+side*.066,.690),(.145,.023,.242),mats["tin"],.004)
        cage.box((x,J1_ENTRY_Y,.566),(.145,.124,.018),mats["brass"],.004)
        cage.finish("GROVE_RELAY_CAGE_"+name,contact)

        head = MeshBatch()
        head.cylindrical(x,J1_Z,[(.124,.963),(.130,.977),(.130,1.027),(.119,1.045)],mats["tin"],40,True)
        screw = head.finish("GROVE_RELAY_SCREW_"+name,contact)
        slot = MeshBatch()
        slot.box((x,1.054,J1_Z),(.302,.062,.039),mats["tin"],0,math.radians(30 if name=="COM" else -23))
        cut_mesh(screw,slot.finish("Screwdriver recess"))


def top_print(parent,label,x,y,z,size,mat):
    curve = bpy.data.curves.new(label,"FONT")
    curve.body,curve.align_x,curve.size = label,"CENTER",size
    curve.materials.append(mat)
    obj = bpy.data.objects.new(label,curve)
    bpy.context.collection.objects.link(obj)
    obj.location = blender_point((x,y,z))
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    text = bpy.context.view_layer.objects.active
    text.select_set(False)
    text.parent = parent


def relay(parent,mats):
    case = MeshBatch()
    case.loft([(CASE_BASE,1.871,1.522,.044),(CASE_BASE+.028,1.900,1.550,.049),
               (CASE_BASE+1.543,1.900,1.550,.043),(CASE_BASE+CASE_HEIGHT,1.848,1.498,.031)],
              mats["case"],(CASE_X,CASE_Z))
    shell = case.finish("GROVE_RELAY_CASE",parent)
    shell["Part marking"] = "HLS8L-DC3V-S-C"
    shell["Housing dimensions mm"] = [19.0,15.5,15.8]
    seam = MeshBatch()
    seam.box((CASE_X,CASE_BASE+.061,CASE_Z),(1.907,.027,1.557),mats["seam"],.019)
    seam.finish("GROVE_RELAY_LOWER_CASE_SEAM",parent)
    ink = empty("GROVE_RELAY_CASE_MARKINGS")
    ink.parent = parent
    label_y = CASE_BASE+CASE_HEIGHT+.001
    top_print(ink,"HE LI SHUN",CASE_X,label_y,CASE_Z-.348,.177,mats["ink"])
    top_print(ink,"HLS8L-DC3V-S-C",CASE_X,label_y,CASE_Z-.095,.135,mats["ink"])
    top_print(ink,"3 VDC COIL",CASE_X,label_y,CASE_Z+.320,.100,mats["ink"])


def passives(parent,mats):
    small = MeshBatch()
    for x,z,turn,color in [(-1.143,-.4445,0,"dark"),(-.8255,-.4445,0,"dark"),
                            (-.508,-.6858,math.pi/2,"dark"),(-.8128,-.1397,math.pi/2,"ceramic")]:
        small.box((x,.384,z),(.167,.061,.083),mats[color],.007,turn)
        for side in (-1,1):
            dx,dz = rotate(side*.071,0,turn)
            small.box((x+dx,.380,z+dz),(.039,.056,.091),mats["tin"],.004,turn)
    for x,z in [(-.77597,-.68453),(-1.0795,-.1524)]:
        small.box((x,.422,z),(.139,.122,.290),mats["dark"],.014)
        for dx,dz in [(-.091,-.095),(-.091,.095),(.091,0)]:
            small.box((x+dx,.375,z+dz),(.075,.050,.052),mats["tin"],.004)
    small.box((D3_X,.370,D3_Z),(.181,.036,.093),mats["ceramic"],.006)
    for side in (-1,1):
        small.box((D3_X+side*.080,.368,D3_Z),(.041,.033,.085),mats["tin"],.004)
    small.finish("GROVE_RELAY_Q1_U9_RESISTORS_LED_BASE",parent)

    diode = MeshBatch()
    front_cylinder(diode,-.508,.429,[(-.399,.053),(-.356,.070),(-.085,.070),(-.047,.055)],mats["glass"],24)
    for start,end in [(-.405,-.365),(-.078,-.036)]:
        front_cylinder(diode,-.508,.429,[(start,.057),(end,.071)],mats["tin"],24)
    front_cylinder(diode,-.508,.429,[(-.313,.071),(-.280,.071)],mats["dark"],24)
    diode.finish("GROVE_RELAY_FLYBACK_DIODE",parent)

    led = MeshBatch()
    led.box((D3_X,D3_TOP-.014,D3_Z),(.122,.028,.070),mats["lens"],.011)
    lens = led.finish("GROVE_RELAY_RED_LENS",parent)
    lens["Emitter"] = "D3 red status LED"

    inks = empty("GROVE_RELAY_PCB_SILK")
    inks.parent = parent
    for label,x,z in [("J2",-1.635,-.578),("J1",-1.325,.672),("D3",-1.143,-.791),("Q1",-.77597,-.849),
                      ("R2",-1.170,-.529),("R1",-.838,-.526),("R3",-.506,-.862),("U1",-.258,-.864)]:
        top_print(inks,label,x,TOP+.002,z,.092,mats["silk"])


def studio():
    scene = bpy.context.scene
    ground = MeshBatch()
    ground.box((0,.077,0),(36,.030,36),material("Studio backdrop","c2d0d5",0,.76),0)
    ground.finish("Studio backdrop")
    scene.world = bpy.data.worlds.new("Soft studio sky")
    scene.world.use_nodes = True
    sky = scene.world.node_tree.nodes.get("Background")
    sky.inputs["Color"].default_value = (.68,.76,.80,1)
    sky.inputs["Strength"].default_value = .41
    focus = blender_point((0,.841,.025))
    for name,point,power,size in [("Key",(-4.0,5.7,4.4),570,4.7),
                                  ("Fill",(4.4,3.5,3.6),290,3.7),
                                  ("Edge",(2.0,3.8,-4.4),460,3.0)]:
        light = bpy.data.lights.new(name,"AREA")
        light.energy,light.shape,light.size = power,"DISK",size
        obj = bpy.data.objects.new(name,light)
        bpy.context.collection.objects.link(obj)
        obj.location = blender_point(point)
        aim(obj,focus)
    camera = bpy.data.cameras.new("Grove Relay studio")
    camera.type,camera.ortho_scale = "ORTHO",4.99
    view = bpy.data.objects.new("Grove Relay studio",camera)
    bpy.context.collection.objects.link(view)
    view.location = blender_point((-1.37,7.1,4.45))
    aim(view,focus)
    scene.camera = view
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x,scene.render.resolution_y = 900,760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    return scene


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--blend",type=Path)
    parser.add_argument("--render",type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {key: material(name,color,metal,rough)
            for key,name,color,metal,rough in [
                ("mask","Seeed blue solder mask","13526a",.02,.42),
                ("laminate","Routed FR4 edge","657471",.02,.59),
                ("case","Textured black relay shell","23262a",.02,.43),
                ("seam","Sealed case lower bead","383d3d",.01,.61),
                ("nylon","Natural white keyed housing","e9e7d7",.01,.45),
                ("green","Screw terminal green nylon","4b9459",.01,.43),
                ("tin","Nickel and tin surfaces","c3ccc9",.76,.30),
                ("brass","Clamp backing brass","96753d",.70,.35),
                ("dark","Black semiconductors","2b2a27",.02,.48),
                ("ceramic","Pale substrate","d8c6a2",.02,.50),
                ("glass","1N4148 red-orange body","9d3d21",.11,.30),
                ("lens","D3 neutral pale red lens","f1d9c5",0,.38),
                ("ink","Relay face off-white print","d9ddda",0,.60),
                ("silk","PCB top silkscreen","dce3df",0,.63),
            ]}
    root = empty("GROVE_RELAY_COMMON")
    root["Board"] = "Seeed Grove Relay v1.2 (103020005)"
    root["Manufacturer reference"] = REFERENCE
    root["Eagle board data"] = CAD
    root["Relay case drawing"] = DATASHEET
    root["Axes"] = "Numeric centimetres. +Y up, J1 wire entries face +Z."
    root["Scope"] = "Exterior reconstruction with exposed terminals. Internal actuator is enclosed."
    board(root,mats)
    grove(root,mats)
    screws(root,mats)
    relay(root,mats)
    passives(root,mats)

    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()),export_format="GLB",
                              export_yup=True,export_extras=True)
    if args.render or args.blend:
        scene = studio()
    if args.blend:
        args.blend.parent.mkdir(parents=True,exist_ok=True)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()),compress=True)
    if args.render:
        args.render.parent.mkdir(parents=True,exist_ok=True)
        scene.render.filepath = str(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
