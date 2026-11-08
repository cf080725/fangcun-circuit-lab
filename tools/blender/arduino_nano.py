"""Build a Blender 4.5 LTS model of the original Gravitech Arduino Nano V3.0.

  blender -b -t 5 -P tools/blender/arduino_nano.py -- --output dist/models/arduino-nano-detail.glb

Add --blend and --render for the editable scene and a studio PNG. Coordinates
are centimetres, +Y up, Mini-B facing -Z. Main male side pins, four LEDs,
RESET actuator, and interactive legends are placed by the web workbench.

The common 17.78×43.18 mm outline and 30+6 hole grid use Arduino NanoV3.3
official A000005 CAD as a dimensional reference. The rear arrangement uses
the same CAD for placement estimates. The front represents the earlier
Gravitech V3.0 TQFP board in David A. Mellis's photo, with component identities
checked against the original schematic. It does not use V3.3's VQFN package.
Copper artwork, heights, solder appearance and connector cavity are visual
reconstructions, and the old board's rear positioning is approximate.

CAD by Arduino, adapted to Blender. The CAD-derived mesh is CC BY-SA 4.0.
https://docs.arduino.cc/static/e3c4fe1f9bee7ec63df398422b3257f4/A000005-cad-files.zip
https://creativecommons.org/licenses/by-sa/4.0/
Original Arduino V3.0 schematic, CC BY-SA 2.5, used for part identification.
https://www.arduino.cc/en/uploads/Main/ArduinoNano30Schematic.pdf
Photo by David A. Mellis, CC BY 2.0, used as a visual reference.
https://commons.wikimedia.org/wiki/File:Arduino_Nano.jpg
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material, rotate


WIDTH,LENGTH,BOTTOM,TOP=1.778,4.318,.21,.35
PITCH,HEADER_X=.254,.762
GPIO=[(x,(i-7)*PITCH,.04572,.08890) for x in (-HEADER_X,HEADER_X) for i in range(15)]
ICSP=[(x,z,.05080,.07750) for x in (-PITCH,0,PITCH) for z in (2.02184,1.76784)]
MOUNT=[(x,z,.08255) for x in (-.762,.762) for z in (-2.032,2.032)]
USB_PEGS=[(x,-1.74288,.0475) for x in (-.22,.22)]
MCU_CENTER=(0,-.66)
CAD_URL="https://docs.arduino.cc/static/e3c4fe1f9bee7ec63df398422b3257f4/A000005-cad-files.zip"
CAD_LICENSE="https://creativecommons.org/licenses/by-sa/4.0/"
SCHEMATIC="https://www.arduino.cc/en/uploads/Main/ArduinoNano30Schematic.pdf"
PHOTO="https://commons.wikimedia.org/wiki/File:Arduino_Nano.jpg"


def annulus(batch,x,z,profile,mat,segments=20):
    points=[(x+r*math.cos(a),y,z+r*math.sin(a)) for r,y in profile
            for a in [i*math.tau/segments for i in range(segments)]]
    batch.add(points,loops_faces(segments,len(profile)),mat)


def pcb(root,mats):
    blank=MeshBatch()
    blank.loft([(BOTTOM,WIDTH,LENGTH,.016),(BOTTOM+.005,WIDTH,LENGTH,.016),
                (TOP-.005,WIDTH,LENGTH,.016),(TOP,WIDTH,LENGTH,.016)],mats['mask'],
               sides=[mats['edge'],mats['laminate'],mats['edge']])
    board=blank.finish('NANO_PCB',root)
    board['Official outline millimetres']=[17.78,43.18]
    drills=MeshBatch()
    holes=[(x,z,r) for x,z,r,_ in [*GPIO,*ICSP]]
    for x,z,r in [*holes,*MOUNT,*USB_PEGS]:
        drills.cylindrical(x,z,[(r,.16),(r,.40)],mats['mask'],20,True)
    cut_mesh(board,drills.finish('Nano CAD drill tools'))
    for name,contacts in [('NANO_GPIO_PLATING',GPIO),('NANO_ICSP_PLATING',ICSP)]:
        plating=MeshBatch()
        for x,z,r,outer in contacts:
            inner=r-.0005
            annulus(plating,x,z,[(outer,BOTTOM-.002),(r+.002,BOTTOM-.002),(inner,BOTTOM+.003),
                                  (inner,TOP-.003),(r+.002,TOP+.002),(outer,TOP+.002)],mats['tin'])
        obj=plating.finish(name,root,closed=False)
        obj['Contact count']=len(contacts)
        obj['Drill diameter millimetres']=contacts[0][2]*20


def icsp(root,mats):
    shell,posts=MeshBatch(),MeshBatch()
    for x in (-PITCH,0,PITCH):
        shell.loft([(.352,.242,.495,.025),(.373,.252,.506,.026),(.570,.252,.506,.027),
                    (.596,.222,.478,.024)],mats['plastic'],center=(x,1.89484))
    for x,z,_,_ in ICSP:
        posts.loft([(.161,.046,.046,.005),(.173,.063,.063,.005),(.590,.063,.063,.004),
                    (1.144,.063,.063,.004),(1.160,.041,.041,.004)],mats['gold'],center=(x,z))
    shell.finish('NANO_ICSP_BLOCK',root)
    obj=posts.finish('NANO_ICSP_POSTS',root)
    obj['Contact count']=6
    obj['Pin 1 x and z cm']=[-.254,2.02184]
    obj['Tip Y cm']=1.16


def usb_section(z,width,y0,y1):
    half=width/2
    outline=[(-half+.077,y0),(half-.077,y0),(half,y0+.080),
             (half,y1-.032),(half-.030,y1),(-half+.030,y1),(-half,y1-.032),(-half,y0+.080)]
    return [(x,y,z) for x,y in outline]


def mini_usb(root,mats):
    metal=MeshBatch()
    sections=[(-2.370,.690,.385,.693),(-2.412,.690,.385,.693),
              (-2.418,.745,.350,.728),(-2.381,.761,.350,.736),
              (-1.558,.756,.351,.731),(-1.522,.712,.362,.713),
              (-1.522,.650,.394,.674),(-2.370,.650,.394,.674)]
    vertices=[point for section in sections for point in usb_section(*section)]
    last=len(vertices)-8
    seam=[(last+i,last+(i+1)%8,(i+1)%8,i) for i in range(8)]
    metal.add(vertices,[*loops_faces(8,len(sections)),*seam],mats['steel'])
    for side in (-1,1):
        for z in (-2.035,-1.550):
            metal.box((side*.412,.364,z),(.155,.029,.147),mats['tin'],.015)
        metal.box((side*.250,.738,-2.146),(.093,.004,.205),mats['shadow'],.021)
        metal.box((side*.273,.743,-2.168),(.030,.010,.143),mats['steel'],.012)
    metal.box((0,.742,-1.861),(.281,.012,.155),mats['steel'],.021)
    metal.finish('NANO_MINI_USB_OPEN_SHELL',root)

    dielectric=MeshBatch()
    dielectric.box((0,.538,-1.573),(.646,.311,.135),mats['plastic'],.011)
    dielectric.box((0,.486,-1.976),(.491,.111,.726),mats['usb'],.012)
    for i in range(-2,3):
        x=i*.080
        dielectric.box((x,.544,-2.006),(.033,.010,.554),mats['gold'],.003)
        dielectric.box((x,.357,-1.485),(.040,.015,.166),mats['tin'],0)
    for x,z,r in USB_PEGS:
        dielectric.cylindrical(x,z,[(r-.006,BOTTOM-.015),(r-.006,TOP+.01)],mats['plastic'],16,True)
    dielectric.finish('NANO_MINI_USB_TONGUE_AND_CONTACTS',root)


def gullwing(batch,profile,side_width,center,angle,mat):
    x,z=center
    vertices=[(x+rx,y,z+rz) for width in (-side_width/2,side_width/2)
              for length,y in profile for rx,rz in [rotate(length,width,angle)]]
    count=len(profile)
    batch.add(vertices,[tuple(reversed(range(count))),*loops_faces(count,2),tuple(range(count,2*count))],mat)


def atmega(root,mats):
    main=MeshBatch()
    angle=math.pi/4
    main.loft([(.368,.674,.674,.025),(.385,.700,.700,.026),
               (.453,.700,.700,.025),(.470,.668,.668,.023)],mats['mold'],MCU_CENTER,angle)
    lead=[(.331,.408),(.370,.408),(.404,.370),(.450,.370),(.450,.351),
          (.398,.351),(.361,.388),(.331,.388)]
    x,z=MCU_CENTER
    for side in range(4):
        direction=angle+side*math.pi/2
        for pin in range(8):
            ox,oz=rotate(0,(pin-3.5)*.080,direction)
            gullwing(main,lead,.028,(x+ox,z+oz),direction,mats['pin'])
            tx,tz=rotate(.421,(pin-3.5)*.080,direction)
            main.box((x+tx,TOP+.002,z+tz),(.102,.004,.039),mats['tin'],0,direction)
    main.cylindrical(x,z+.366,[(.028,.470),(.028,.471)],mats['mark'],16,True)
    obj=main.finish('NANO_ATMEGA328P_PACKAGE',root)
    obj['Part']='ATmega328P-AU, TQFP-32, 7×7 mm'
    obj['Centre x and z cm']=MCU_CENTER
    obj['Lead count']=32


def rear_devices(root,mats):
    bridge=MeshBatch()
    x,z=.0038,-1.1176
    bridge.loft([(.028,.505,.948,.022),(.046,.529,.986,.025),
                 (.181,.529,.986,.027),(.200,.506,.961,.023)],mats['mold'],(x,z))
    profile=[(.251,.119),(.284,.119),(.324,.190),(.390,.190),(.390,.207),
             (.314,.207),(.275,.137),(.251,.137)]
    for side in (-1,1):
        for pin in range(14):
            lead_z=z+(pin-6.5)*.065
            gullwing(bridge,profile,.030,(x,lead_z),0 if side>0 else math.pi,mats['pin'])
            bridge.box((x+side*.348,BOTTOM-.001,lead_z),(.123,.006,.041),mats['tin'],0)
    bridge.cylindrical(x-.165,z+.369,[(.025,.026),(.025,.029)],mats['mark'],14,True)
    ft=bridge.finish('NANO_FT232RL_PACKAGE',root)
    ft['Part']='FT232RL, SSOP-28, rear face'
    ft['Lead count']=28

    regulator=MeshBatch()
    x,z=-.2413,1.1557
    regulator.loft([(.032,.617,.333,.026),(.051,.653,.359,.029),
                    (.183,.653,.359,.029),(.204,.624,.338,.023)],mats['mold'],(x,z))
    for i in (-1,0,1):
        lead_x=x+i*.231
        regulator.box((lead_x,.176,z-.216),(.073,.029,.111),mats['pin'],.005)
        regulator.box((lead_x,.202,z-.293),(.089,.016,.126),mats['tin'],.004)
    regulator.box((x,.194,z+.257),(.367,.033,.218),mats['tin'],.014)
    part=regulator.finish('NANO_REAR_5V_REGULATOR',root)
    part['Part']='Original schematic UA78M05, SOT-223 exterior'


def smd(batch,mats,x,z,w,d,height,rear=False,resistor=False,angle=0):
    y=BOTTOM-height/2 if rear else TOP+height/2
    batch.box((x,y,z),(w,height,d),mats['mold'] if resistor else mats['ceramic'],.007,angle)
    for side in (-1,1):
        dx,dz=rotate(side*w*.40,0,angle)
        batch.box((x+dx,y,z+dz),(w*.21,height+.003,d+.004),mats['tin'],0,angle)


def details(root,mats):
    top=MeshBatch()
    x,z=.394,-.137
    top.box((x,.370,z),(.320,.040,.169),mats['tin'],.014,-math.pi/4)
    top.box((x,.401,z),(.280,.050,.145),mats['ceramic'],.012,-math.pi/4)
    top.box((x,.426,z),(.248,.012,.120),mats['steel'],.011,-math.pi/4)
    for sx,sz in [(-.498,1.70),(.515,-1.17),(0,-.045)]:
        annulus(top,sx,sz,[(.020,TOP+.003),(.055,TOP+.003)],mats['tin'],18)
    for side in (-1,1):
        top.box((-.058+side*.218,TOP+.002,.239),(.09,.005,.175),mats['tin'],.006)
    for x in (-.49,-.15,.20,.475):
        for z in (.654,.806):
            top.box((x,TOP+.002,z),(.094,.005,.072),mats['tin'],0)
    top.finish('NANO_RESONATOR_AND_TOP_LANDS',root)

    back=MeshBatch()
    placements=[(-.587,-1.457,.165,.090,0),(-.277,-1.611,.320,.155,math.pi/2),(.012,-1.682,.165,.090,0),
                (-.282,-.507,.158,.093,0),(-.284,-.167,.164,.093,0),(-.311,.203,.310,.160,math.pi/2),
                (.330,.203,.310,.160,math.pi/2),(-.539,.698,.162,.092,0),(.039,.805,.163,.094,0),
                (.229,.994,.321,.163,0),(.496,.969,.158,.093,0),(.343,.695,.397,.203,0)]
    for i,(x,z,w,d,angle) in enumerate(placements):
        smd(back,mats,x,z,w,d,.065 if w>.28 else .038,rear=True,resistor=i in (5,6,11),angle=angle)
    back.finish('NANO_REAR_PASSIVES',root)


def traces(root,mats):
    front,back=MeshBatch(),MeshBatch()
    for side in (-1,1):
        for i in range(15):
            z=(i-7)*PITCH
            d=MCU_CENTER[1]+(i-7)*.042
            turn=.62-(i%5)*.030
            level=TOP+.001+i*.00007
            front.ribbon([(side*.678,z),(side*.646,z),(side*turn,z+(d-z)*.15),
                          (side*(turn-.075),d),(side*.30,d)],level,.014,mats['trace'])
            if i%2==0:
                back.ribbon([(side*.682,z),(side*.590,z),(side*.530,z-.112),
                             (side*(.41-(i%3)*.036),z-.112)],BOTTOM-.006-i*.00007,.012,mats['trace_back'])
    front.finish('NANO_TOP_ROUTING_ARTWORK',root,closed=False)
    back.finish('NANO_REAR_ROUTING_ARTWORK',root,closed=False)


def studio():
    scene=bpy.context.scene
    ground=MeshBatch()
    ground.box((0,-.018,0),(60,.015,60),material('Studio background','d7dfdf',0,.72),0)
    ground.finish('Evidence ground').hide_set(True)
    scene.world=bpy.data.worlds.new('Studio ambient')
    scene.world.use_nodes=True
    shader=scene.world.node_tree.nodes.get('Background')
    shader.inputs['Color'].default_value=(.56,.65,.72,1)
    shader.inputs['Strength'].default_value=.43
    center=(0,.37,-.08)
    for name,point,watts,size in [('Key',(-3,5,-4),660,4),('Fill',(5,5,2),435,4),('Rim',(-1,5,6),590,5)]:
        lamp=bpy.data.lights.new(name,'AREA')
        lamp.energy,lamp.shape,lamp.size=watts,'DISK',size
        obj=bpy.data.objects.new(name,lamp)
        bpy.context.collection.objects.link(obj)
        obj.location=blender_point(point)
        aim(obj,blender_point(center))
        obj.hide_set(True)
    camera=bpy.data.cameras.new('Studio camera')
    camera.type,camera.ortho_scale='ORTHO',5.5
    obj=bpy.data.objects.new('Studio camera',camera)
    bpy.context.collection.objects.link(obj)
    obj.location=blender_point((3.7,7.7,-6.8))
    aim(obj,blender_point(center))
    scene.camera=obj
    obj.hide_set(True)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                view=area.spaces.active.region_3d
                view.view_location=Vector(blender_point(center))
                view.view_rotation=obj.rotation_euler.to_quaternion()
                view.view_distance=5.8
                view.view_perspective='ORTHO'
                area.spaces.active.shading.color_type='MATERIAL'
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.resolution_x=scene.render.resolution_y=1000
    scene.render.image_settings.file_format='PNG'
    return scene


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--blend',type=Path)
    parser.add_argument('--render',type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats={name:material(name,color,metal,roughness) for name,color,metal,roughness in [
        ('mask','156c80',.03,.51),('edge','7f805b',.05,.62),('laminate','9b9658',.05,.67),
        ('trace','287c8a',.12,.47),('trace_back','266b78',.09,.54),('steel','bbc1bd',.85,.29),
        ('shadow','667270',.60,.46),('tin','b5c4c3',.74,.33),('pin','c4cccb',.80,.34),
        ('gold','d4b06a',.73,.33),('mold','242a2b',.03,.57),('mark','4b5351',.03,.62),
        ('plastic','242729',.02,.59),('usb','353a36',.04,.63),('ceramic','bca06f',.12,.53),
    ]}
    root=empty('NANO_COMMON')
    root['Variant']='Gravitech Arduino Nano V3.0, TQFP-32 front, original Mini-B'
    root['CAD source']=CAD_URL
    root['CAD licence']=CAD_LICENSE
    root['Original schematic']=SCHEMATIC
    root['Visual reference']=PHOTO
    root['Credit']='Common CAD from Arduino A000005 NanoV3.3, adapted in Blender. Front based on David A. Mellis photo (CC BY 2.0).'
    root['Dimensions and limits']='Numerical cm; Y up, USB -Z. Front V3.0 styling; rear component locations estimated from V3.3; artwork and USB internals illustrative.'
    pcb(root,mats)
    icsp(root,mats)
    mini_usb(root,mats)
    atmega(root,mats)
    rear_devices(root,mats)
    details(root,mats)
    traces(root,mats)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()),export_format='GLB',export_yup=True,export_extras=True)
    if args.blend or args.render:
        scene=studio()
    if args.blend:
        bpy.context.preferences.filepaths.save_version=0
        args.blend.parent.mkdir(parents=True,exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()))
    if args.render:
        args.render.parent.mkdir(parents=True,exist_ok=True)
        scene.render.filepath=str(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    main()
