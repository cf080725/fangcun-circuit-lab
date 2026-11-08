"""Create the Adafruit #5027 MCP9808 STEMMA QT breakout in Blender 4.5.

  blender -b -t 4 -P tools/blender/mcp9808_5027.py -- --output dist/models/mcp9808-5027.glb

Measured outline and mounting/component positions come from Adafruit's Eagle
board. Package finishes and visible trace artwork are reconstructed. The GLB
uses numeric centimetres, +Y up, with the six header holes along +Z.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material, rounded_outline


CAD = "https://github.com/adafruit/Adafruit-MCP9808-Breakout-PCB/blob/master/Adafruit%20MCP9808%20STEMMA%20QT.brd"
PRODUCT = "https://www.adafruit.com/product/5027"
WIDTH, DEPTH, TOP = 2.540, 1.778, .160
HEADER = [(name,(index-2.5)*.254,.635) for index,name in enumerate(["VIN","GND","SCL","SDA","ALERT","A0"])]
MOUNTS = [(x,z) for x in [-1.016,1.016] for z in [-.635,.635]]
LED_X, LED_Z = -.8636, -.3683


def board(parent,mats):
    outline=rounded_outline(WIDTH,DEPTH,.254,12)
    count=len(outline)
    batch=MeshBatch()
    batch.add([(x,y,z) for y in [0,TOP] for x,z in outline],
              [tuple(reversed(range(count))),*loops_faces(count,2),tuple(range(count,2*count))],mats["mask"])
    batch.materials.append(mats["laminate"])
    batch.indices[1:count+1]=[1]*count
    pcb=batch.finish("MCP9808_PCB",parent)
    pads=[(x,z,.125,.160) for x,z in MOUNTS]+[(x,z,.050,.0889) for _,x,z in HEADER]
    drills=MeshBatch()
    for x,z,inner,_ in pads:
        drills.cylindrical(x,z,[(inner,-.025),(inner,TOP+.025)],mats["gold"],24,True)
    cut_mesh(pcb,drills.finish("Board drill cutters"))
    metal=MeshBatch()
    for x,z,inner,outer in pads:
        metal.cylindrical(x,z,[(inner-.001,-.002),(outer,-.002),(outer,0),(inner-.001,0),
                              (inner-.001,TOP),(outer,TOP),(outer,TOP+.003),(inner-.001,TOP+.003)],
                         mats["gold"],28)
    for x,z in [(-.762,.4318),(.6858,-.762)]:
        metal.cylindrical(x,z,[(.039,TOP+.001),(.039,TOP+.004)],mats["gold"],20,True)
    metal.finish("MCP9808_PLATED_BORES",parent,closed=False)
    tracks=MeshBatch()
    for path in [[(-.635,.54),(-.635,.28),(-.46,.12),(-.25,.10)],
                 [(-.127,.54),(-.127,.28),(-.09,.21),(-.09,.15)],
                 [(.127,.54),(.127,.30),(.078,.24),(.078,.15)],
                 [(.635,.54),(.487,.30),(.487,.11),(.26,.101)],
                 [(-.86,-.37),(-.72,-.465),(-.18,-.465),(-.05,-.323)],
                 [(.16,-.18),(.27,-.36),(.74,-.36)]]:
        tracks.ribbon(path,TOP+.0015,.021,mats["route"])
    tracks.finish("MCP9808_ILLUSTRATIVE_ROUTING",parent,closed=False)


def chip(parent,mats):
    package=MeshBatch()
    package.loft([(TOP+.024,.280,.280,.019),(TOP+.044,.300,.300,.019),
                  (TOP+.108,.288,.289,.018),(TOP+.113,.279,.280,.016)],mats["chip"])
    package.finish("MCP9808_MSOP8_BODY",parent)
    ink=MeshBatch()
    ink.cylindrical(-.105,-.106,[(.022,TOP+.113),(.022,TOP+.115)],mats["dot"],24,True)
    ink.finish("MCP9808_MSOP8_PIN1",parent)
    leads=MeshBatch()
    for side in [-1,1]:
        for z in [-.0975,-.0325,.0325,.0975]:
            xz=[(.146,TOP+.069),(.171,TOP+.069),(.187,TOP+.055),(.223,TOP+.014),(.253,TOP+.014)]
            vertices=[(side*x,y+dy,z+dz) for x,y in xz
                      for dy,dz in [(-.006,-.017),(-.006,.017),(.006,.017),(.006,-.017)]]
            leads.add(vertices,[(3,2,1,0),*loops_faces(4,len(xz)),tuple(range(len(vertices)-4,len(vertices)))],mats["tin"])
            leads.box((side*.223,TOP+.003,z),(.125,.008,.039),mats["gold"],.004)
    leads.finish("MCP9808_MSOP8_GULLWING_LEADS",parent)


def contacts(parent,mats):
    for side in [-1,1]:
        x=side*1.0033
        name="LEFT" if side<0 else "RIGHT"
        shell=MeshBatch()
        for y in [TOP+.024,TOP+.275]:
            shell.box((x,y,0),(.425,.048,.610),mats["socket"],.014)
        for z in [-.274,.274]:
            shell.box((x,TOP+.147,z),(.425,.254,.061),mats["socket"],.012)
        shell.box((x-side*.175,TOP+.147,0),(.075,.253,.509),mats["socket"],.012)
        shell.finish("MCP9808_JST_SH_"+name+"_HOUSING",parent)
        metal=MeshBatch()
        for offset in [-.15,-.05,.05,.15]:
            metal.box((x+side*.003,TOP+.102,offset),(.305,.024,.027),mats["gold"],.004)
            metal.box((x-side*.242,TOP+.023,offset),(.116,.043,.049),mats["tin"],.004)
        for offset in [-.277,.277]:
            metal.box((x+side*.149,TOP+.011,offset),(.126,.018,.071),mats["tin"],.004)
        metal.finish("MCP9808_JST_SH_"+name+"_CONTACTS",parent)


def components(parent,mats):
    parts=MeshBatch()
    for x,z,width,depth,height in [(-.4699,.2921,.196,.126,.079),(0,-.254,.147,.081,.057)]:
        parts.box((x,TOP+height/2,z),(width,height,depth),mats["ceramic"],.008)
        for side in [-1,1]:
            parts.box((x+side*width*.41,TOP+height*.42,z),(.040,height*.84,depth+.012),mats["tin"],.004)
    for x in [-.4826,.4826]:
        parts.box((x,TOP+.036,0),(.147,.070,.307),mats["chip"],.012)
        for side in [-1,1]:
            for z in [-.100,-.034,.034,.100]:
                parts.box((x+side*.077,TOP+.013,z),(.057,.024,.039),mats["tin"],.003)
    for x,z,y in [(-.5588,-.3175,TOP+.003),(.8382,.254,-.002),(.6096,.254,-.002),(.381,.254,-.002)]:
        for side in [-1,1]:
            parts.box((x+side*.057,y,z),(.097,.009,.159),mats["gold"],.009)
    parts.box((LED_X,TOP+.022,LED_Z),(.145,.041,.084),mats["ceramic"],.008)
    for side in [-1,1]:
        parts.box((LED_X+side*.061,TOP+.018,LED_Z),(.033,.030,.088),mats["tin"],.005)
    parts.finish("MCP9808_SUPPORT_COMPONENTS_AND_JUMPERS",parent)
    lens=MeshBatch()
    lens.box((LED_X,TOP+.052,LED_Z),(.084,.040,.070),mats["led"],.013)
    lens.finish("MCP9808_POWER_LED_LENS",parent)


def silk(parent,mats):
    labels=[("MCP9808",.0635,-.762,.143,False),("Temp Sensor",.127,-.5715,.106,False),
            ("on",-.960,-.400,.082,False),("9808",0,0,.067,False),
            *((name,x+(0.0127 if name=="ALERT" else 0),z+(.1651 if index%2==0 else -.1651),.096,False)
              for index,(name,x,z) in enumerate(HEADER)),
            ("MCP9808",.127,-.7493,.131,True),("Default I2C 0x18",-.24,.35,.088,True),
            ("AD0",.8382,-.09,.073,True),("AD1",.6096,-.09,.073,True),("AD2",.381,-.09,.073,True)]
    for index,(text,x,z,size,rear) in enumerate(labels):
        font=bpy.data.curves.new("Board silk "+text,"FONT")
        font.body,font.size,font.align_x,font.align_y=text,size,"CENTER","CENTER"
        obj=bpy.data.objects.new(f"MCP9808_SILK_{index}",font)
        bpy.context.collection.objects.link(obj)
        obj.parent=parent
        y=-.004 if rear else TOP+.116 if text=="9808" else TOP+.005
        obj.location=blender_point((x,y,z))
        if rear: obj.rotation_euler.y=math.pi
        font.materials.append(mats["ink"])
        bpy.context.view_layer.objects.active=obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        obj.select_set(False)


def studio(output):
    scene=bpy.context.scene
    floor=MeshBatch()
    floor.box((0,-.050,0),(12,.038,12),material("Studio floor","bdc7cc",roughness=.7),0)
    floor.finish("Studio floor")
    scene.world=bpy.data.worlds.new("Soft ambient")
    scene.world.use_nodes=True
    ambient=scene.world.node_tree.nodes.get("Background")
    ambient.inputs["Color"].default_value=(.56,.64,.72,1)
    ambient.inputs["Strength"].default_value=.59
    target=(0,.15,0)
    for name,point,energy,size in [("Key",(-3.2,4.4,3.2),300,4.1),("Fill",(2.6,3.1,-.4),195,3.0),
                                  ("Rim",(.3,2.8,-3.4),270,2.8)]:
        data=bpy.data.lights.new(name,"AREA")
        data.energy,data.shape,data.size=energy,"DISK",size
        obj=bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(obj)
        obj.location=blender_point(point)
        aim(obj,blender_point(target))
    data=bpy.data.cameras.new("MCP9808 studio")
    data.type,data.ortho_scale="ORTHO",3.53
    camera=bpy.data.objects.new("MCP9808 studio",data)
    bpy.context.collection.objects.link(camera)
    camera.location=blender_point((2.18,5.5,3.4))
    aim(camera,blender_point(target))
    scene.camera=camera
    scene.render.engine="CYCLES"
    scene.cycles.samples=20
    scene.cycles.use_denoising=True
    scene.render.resolution_x,scene.render.resolution_y=960,760
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.filepath=str(output)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--render",type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats={key:material(name,color,metal,roughness) for key,name,color,metal,roughness in [
        ("mask","Black PCB solder mask","212628",.06,.58),("laminate","Exposed FR4 edge","8b7c58",.02,.68),
        ("route","Illustrative traces beneath solder mask","3a4041",.09,.60),
        ("gold","Immersion gold plating","c6a463",.76,.31),("tin","Solder and gull-wing leads","bcc4c6",.74,.36),
        ("socket","Cream JST SH molded housing","e3dfcf",.02,.55),("ceramic","Ceramic passives","b39979",.03,.63),
        ("chip","Dark molded chip packages","25282a",.03,.53),("dot","Pin 1 mark","45494c",.02,.55),
        ("led","Unpowered green LED lens","668d52",.03,.36),("ink","Light PCB labels","e4e8dd",0,.62)]}
    root=empty("MCP9808_5027_COMMON")
    root["Manufacturer"],root["PCB source"]=PRODUCT,CAD
    root["Reference"]="Adafruit #5027 MCP9808 STEMMA QT, 25.40 × 17.78 × 4.60 mm"
    root["Units"]="Numeric cm, +Y up, through-hole header at +Z"
    root["Simulated endpoints"]="VIN, GND, SCL, SDA through-holes. ALERT, A0 and JST-SH are visual."
    board(root,mats)
    chip(root,mats)
    contacts(root,mats)
    components(root,mats)
    silk(root,mats)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()),export_format="GLB",
                             export_yup=True,export_extras=True)
    if args.render:
        args.render.parent.mkdir(parents=True,exist_ok=True)
        studio(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__=="__main__":
    main()
