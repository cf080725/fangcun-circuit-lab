"""Reconstruct the Adafruit #326 SSD1306 STEMMA QT board in Blender 4.5 LTS.

  blender -b -t 4 -P tools/blender/ssd1306_326.py -- --output dist/models/ssd1306-326.glb

The board outline, plated bores, JST-SH placements and OLED cutout derive
from the Adafruit Eagle board file. The bare active area is a separate mesh
at the live renderer's display plane. Package finishes and rear electronics
are visual approximations. Add --render to write a studio PNG.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material


CAD = "https://github.com/adafruit/Adafruit-128x64-Monochrome-OLED-PCB"
PANEL = "https://www.adafruit.com/datasheets/UG-2864HSWEG01.pdf"
BASE, TOP, GLASS_TOP = .295, .455, .620
GLASS_Z, PIXEL_Z, PIXEL_Y = -.1428, -.3526, .621
HEADER_Z = -1.3335
MOUNTS = [(x,z) for x in [-1.2065,1.2065] for z in [-1.3335,1.3335]]
HEADER = [(name,(index-3.5)*.254) for index,name in enumerate(
    ["Data","Clk","A0","Rst","CS","3Vo","VIN","GND"])]


def arc(x,z,start,end,steps):
    return [(x+.254*math.cos(a),z+.254*math.sin(a))
            for index in range(steps+1) for a in [start+(end-start)*index/steps]]


def outline():
    return [*arc(-1.2065,1.3335,math.pi,0,16),(-.9525,1.0795),(.9525,1.0795),
            *arc(1.2065,1.3335,math.pi,0,16),
            *arc(1.2065,-1.3335,0,-math.pi/2,8),
            *arc(-1.2065,-1.3335,-math.pi/2,-math.pi,8)]


def board(parent,mats):
    points = outline()
    count = len(points)
    batch = MeshBatch()
    sides = loops_faces(count,2)
    batch.add([(x,y,z) for y in [BASE,TOP] for x,z in points],
              [tuple(reversed(range(count))),*sides,tuple(range(count,2*count))],mats["mask"])
    batch.materials.append(mats["laminate"])
    batch.indices[1:count+1] = [1]*count
    pcb = batch.finish("OLED326_PCB",parent)
    pads = [(x,z,.125,.160) for x,z in MOUNTS] + [(x,HEADER_Z,.050,.0889) for _,x in HEADER]
    cut = MeshBatch()
    for x,z,radius,_ in pads:
        cut.cylindrical(x,z,[(radius,BASE-.020),(radius,TOP+.020)],mats["gold"],24,True)
    cut_mesh(pcb,cut.finish("OLED326 drill cutters"))
    gold = MeshBatch()
    for x,z,inner,outer in pads:
        gold.cylindrical(x,z,[(inner-.001,BASE-.003),(outer,BASE-.003),(outer,BASE),
                             (inner-.001,BASE),(inner-.001,TOP),(outer,TOP),
                             (outer,TOP+.003),(inner-.001,TOP+.003)],mats["gold"],28)
    gold.finish("OLED326_PLATED_BORES",parent,closed=False)


def display(parent,mats):
    stack = MeshBatch()
    stack.box((0,.465,GLASS_Z),(2.650,.020,1.902),mats["adhesive"],.016)
    stack.box((0,.517,GLASS_Z),(2.670,.084,1.926),mats["edge"],.010)
    stack.box((0,.5905,GLASS_Z),(2.659,.059,1.912),mats["glass"],.008)
    stack.finish("OLED326_GLASS_STACK",parent)
    plane = MeshBatch()
    hw,hz = 2.1744/2,1.0864/2
    plane.add([(-hw,PIXEL_Y,PIXEL_Z-hz),(-hw,PIXEL_Y,PIXEL_Z+hz),
               (hw,PIXEL_Y,PIXEL_Z+hz),(hw,PIXEL_Y,PIXEL_Z-hz)],[(0,1,2,3)],mats["pixel"])
    plane.finish("OLED326_PIXEL_PLANE",parent,closed=False)


def sockets(parent,mats):
    for side in [-1,1]:
        body = MeshBatch()
        x,z=side*1.2065,-.0635
        for y in [.023,.270]:
            body.box((x,y,z),(.425,.046,.609),mats["socket"],.014)
        for offset in [-.274,.274]:
            body.box((x,.147,z+offset),(.425,.256,.061),mats["socket"],.012)
        body.box((x-side*.175,.149,z),(.075,.251,.513),mats["socket"],.012)
        for offset in [-.180,.180]:
            body.box((x+side*.034,.071,z+offset),(.304,.036,.025),mats["socket"],.006)
        name = "LEFT" if side<0 else "RIGHT"
        body.finish("OLED326_JST_SH_"+name+"_HOUSING",parent)
        contacts = MeshBatch()
        for index in range(4):
            zz=z+(index-1.5)*.10
            contacts.box((x+side*.002,.117,zz),(.310,.023,.027),mats["gold"],.004)
            contacts.box((x-side*.237,.277,zz),(.118,.025,.046),mats["tin"],.005)
        contacts.finish("OLED326_JST_SH_"+name+"_CONTACTS",parent)


def cad_point(x,y):
    return ((14.605-x)/10,(15.875-y)/10)


def rear(parent,mats):
    parts = MeshBatch()
    for xx,yy,w,d,h in [(1.778,24.765,.14,.20,.11),(8.89,24.765,.14,.20,.11),
                         (7.239,24.892,.09,.15,.055),(10.541,15.773,.09,.15,.055),
                         (21.9004,15.814,.14,.20,.11),(19.6144,15.814,.14,.20,.11),
                         (6.985,15.9,.14,.20,.11),(17.7014,15.814,.14,.20,.11),
                         (8.89,15.9,.14,.20,.11),(16.0504,15.814,.09,.15,.055)]:
        x,z = cad_point(xx,yy)
        parts.box((x,BASE-h/2,z),(w,h,d),mats["ceramic"],.009)
        for side in [-1,1]:
            parts.box((x,BASE-h*.39,z+side*d*.42),(w+.009,h*.80,.035),mats["tin"],.005)
    for xx,yy,w,d,h,n in [(4.699,24.511,.251,.151,.11,3),(25.908,25.019,.193,.128,.105,3),
                           (13.335,16.256,.249,.127,.092,3),(16.256,23.368,.259,.118,.063,4)]:
        x,z = cad_point(xx,yy)
        parts.box((x,BASE-h/2,z),(w,h,d),mats["chip"],.014)
        for side in [-1,1]:
            for index in range(n):
                parts.box((x+(index-(n-1)/2)*.059,BASE-.017,z+side*d*.55),
                          (.030,.031,.059),mats["tin"],.004)
    for xx,yy in [(12.9606,21.971),(10.6454,21.971),(20.447,21.209)]:
        x,z = cad_point(xx,yy)
        for side in [-1,1]:
            parts.box((x,BASE-.004,z+side*.067),(.139,.008,.112),mats["gold"],.009)
    parts.finish("OLED326_REAR_COMPONENTS",parent)


def flex(parent,mats):
    ribbon = MeshBatch()
    sections = [(.60,.735,.71),(.59,.829,.68),(.501,1.038,.596),
                (.440,1.100,.580),(.295,1.103,.580),(.263,1.019,.584),
                (.252,.873,.648),(.252,.670,.986),(.252,.458,1.03)]
    vertices = [(x,y,z) for y,z,w in sections for x in [-w,w]]
    faces = [(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(sections)-1)]
    ribbon.add(vertices,faces,mats["flex"])
    top_faces = [(a,b,c,d) for a,b,c,d in faces]
    ribbon.add(vertices,[tuple(reversed(face)) for face in top_faces],mats["flex"])
    ribbon.box((0,.614,.770),(1.299,.023,.314),mats["chip"],.025)
    ribbon.finish("OLED326_FLEX_RIBBON",parent,closed=False)
    tracks = MeshBatch()
    for index in range(30):
        x=(index-14.5)*.063
        tracks.ribbon([(x,.465),(x,.657),(x*.56,.913)],.250,.013,mats["gold"])
        tracks.box((x,.248,.480),(.027,.010,.115),mats["gold"],.003)
    tracks.finish("OLED326_FLEX_CONTACTS",parent,closed=False)


def silk(parent,mats):
    for index,(label,x) in enumerate(HEADER):
        font = bpy.data.curves.new("OLED pin "+label,"FONT")
        font.body,font.size,font.align_x,font.align_y = label,.099,"CENTER","CENTER"
        obj = bpy.data.objects.new("OLED326_SILK_"+label,font)
        bpy.context.collection.objects.link(obj)
        obj.parent = parent
        obj.location = blender_point((x,TOP+.004,HEADER_Z+(.156 if index%2==0 else -.149)))
        font.materials.append(mats["ink"])
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        obj.select_set(False)


def studio(output):
    scene = bpy.context.scene
    floor = MeshBatch()
    floor.box((0,-.040,0),(12,.04,12),material("Studio ground","c4cdd0",roughness=.64),0)
    floor.finish("Studio ground")
    scene.world = bpy.data.worlds.new("Soft ambient")
    scene.world.use_nodes = True
    background=scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value=(.56,.63,.71,1)
    background.inputs["Strength"].default_value=.65
    target=(0,.30,0)
    for name,point,energy,size in [("Key",(-2.8,4.4,-3.2),320,4.0),
                                  ("Fill",(3.2,3.7,-.5),250,3.1),
                                  ("Rim",(.6,3.1,3.5),360,3.4)]:
        data=bpy.data.lights.new(name,"AREA")
        data.energy,data.shape,data.size=energy,"DISK",size
        obj=bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(obj)
        obj.location=blender_point(point)
        aim(obj,blender_point(target))
    data=bpy.data.cameras.new("OLED326 studio")
    data.type,data.ortho_scale="ORTHO",4.25
    camera=bpy.data.objects.new("OLED326 studio",data)
    bpy.context.collection.objects.link(camera)
    camera.location=blender_point((2.45,5.6,4.1))
    aim(camera,blender_point(target))
    scene.camera=camera
    scene.render.engine="CYCLES"
    scene.cycles.samples=20
    scene.cycles.use_denoising=True
    scene.render.resolution_x,scene.render.resolution_y=970,800
    scene.render.image_settings.file_format="PNG"
    scene.render.filepath=str(output)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--render",type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats={key:material(name,color,metal,roughness) for key,name,color,metal,roughness in [
        ("mask","Black PCB solder mask","25292b",.07,.55),
        ("laminate","Exposed FR4 edge","887f60",.04,.67),
        ("gold","Immersion gold contact finish","bfa263",.76,.36),
        ("tin","Tin-plated terminals","b8bec1",.74,.38),
        ("socket","JST SH molded shell","e6e0ce",.02,.56),
        ("ceramic","Ceramic passives","b39b77",.04,.63),
        ("chip","Black package and flexible strain relief","222526",.03,.60),
        ("flex","Amber polyimide cable","a6651f",.26,.42),
        ("adhesive","Panel adhesive","1b2022",.02,.70),
        ("edge","Panel glass edge","636d75",.36,.18),
        ("glass","OLED dark front polarizer","13171c",.21,.29),
        ("pixel","Unpowered visible active area","11161b",.06,.38),
        ("ink","White identification silk","e3e5da",.01,.63)]}
    root=empty("OLED326_COMMON")
    root["Reference"]="Adafruit #326 OLED STEMMA QT (0.96 inch)"
    root["PCB CAD"],root["Panel drawing"]=CAD,PANEL
    root["Units"]="Numeric cm, +Y up, through-hole header toward -Z"
    root["Dimensions"]="29.21 × 31.75 mm including ears; 26.70 × 19.26 mm glass; 21.744 × 10.864 mm active area"
    root["Electrical simulation"]="Data/SDA, Clk/SCL, VIN and GND through-holes; other connectors shown mechanically"
    board(root,mats)
    display(root,mats)
    sockets(root,mats)
    rear(root,mats)
    flex(root,mats)
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
