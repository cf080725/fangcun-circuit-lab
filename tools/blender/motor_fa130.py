"""Create the Mabuchi FA-130RA-18100 exterior in Blender 4.5 LTS.

  blender -b -t 4 -P tools/blender/motor_fa130.py -- --output dist/models/motor-fa130.glb

Use --render to write a studio PNG. The manufacturer drawing supplies the
20.1 × 15.1 × 25 mm body, 2 × 9.4 mm front shaft, bearing boss and tab geometry.
The housing finish, ventilation detail and instructional shaft mark are
independently reconstructed. No vendor artwork or CAD is included.

GLB coordinates are numeric centimetres with +Y up and the body base at Y=0.
The front shaft points -Z. Rotate FA130_ROTOR about local Z. The rear solder
eyes connect to + at positive X and - at negative X.

https://www.mabuchi-motor.co.jp/motorize/branch/motor/pdf/fa_130ra.pdf
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material


DATASHEET = "https://www.mabuchi-motor.co.jp/motorize/branch/motor/pdf/fa_130ra.pdf"
RADIUS, AXIS_Y = 1.005, .755
FRONT, BACK = -1.25, 1.25
SHAFT_NOSE, REAR_STUD = -2.19, 1.61
TAB_X, TAB_Y, TAB_Z = .565, 1.555, .91


def flat_round_outline(radius, half_height, segments=20):
    limit = math.asin(half_height / radius)
    return [(radius*math.cos(a), AXIS_Y+radius*math.sin(a))
            for middle in [0, math.pi] for step in range(segments+1)
            for a in [middle-limit+step*2*limit/segments]]


def axial_shell(batch, sections, mat):
    vertices = [(x, y, z) for radius, height, z in sections
                for x, y in flat_round_outline(radius, height)]
    count = len(vertices)//len(sections)
    faces = [tuple(reversed(range(count))), *loops_faces(count, len(sections)),
             tuple(range(len(vertices)-count, len(vertices)))]
    batch.add(vertices, faces, mat)


def axial_round(batch, x, y, sections, mat, segments=40, capped=True):
    vertices = [(x+radius*math.cos(angle), y+radius*math.sin(angle), z)
                for radius, z in sections for index in range(segments)
                for angle in [index*math.tau/segments]]
    faces = loops_faces(segments, len(sections))
    if capped:
        faces.extend([tuple(reversed(range(segments))),
                      tuple(range(len(vertices)-segments, len(vertices)))])
    batch.add(vertices, faces, mat, smooth=not capped)


def steel_can(parent, mats):
    can = MeshBatch()
    axial_shell(can, [(.944,.695,FRONT), (.988,.740,FRONT+.023),
                      (RADIUS,AXIS_Y,FRONT+.084), (RADIUS,AXIS_Y,1.069),
                      (.990,.742,1.106), (.939,.690,1.107),
                      (.957,.707,1.071), (.957,.707,FRONT+.085),
                      (.921,.677,FRONT+.057)], mats["steel"])
    housing = can.finish("FA130_FLATTED_STEEL_CAN", parent)

    openings = MeshBatch()
    for x in [-.178, .178]:
        openings.box((x,1.493,.686),(.213,.232,.245),mats["steel"],.034)
    for x in [-.949, .949]:
        openings.box((x,.493,-.973),(.190,.151,.180),mats["steel"],.022)
    axial_round(openings,0,AXIS_Y,[(.111,FRONT-.04),(.111,FRONT+.09)],mats["steel"])
    axial_round(openings,0,.265,[(.066,FRONT-.04),(.066,FRONT+.09)],mats["steel"],24)
    cut_mesh(housing, openings.finish("Can tool and ventilation cutouts"))
    for face in housing.data.polygons:
        vertices = [housing.data.vertices[index].co for index in face.vertices]
        # Retain sharp stamped rims and flats while smoothing the curved sides.
        face.use_smooth = (max(point.y for point in vertices)-min(point.y for point in vertices) > .50
                           and max(point.z for point in vertices)-min(point.z for point in vertices) > .001)

    bosses = MeshBatch()
    axial_round(bosses, 0, AXIS_Y,
                [(.112,FRONT+.004),(.3075,FRONT+.004),(.3075,FRONT-.133),
                 (.283,FRONT-.170),(.179,FRONT-.170),(.164,FRONT-.159),
                 (.112,FRONT-.159),(.112,FRONT+.004)], mats["rim"], capped=False)
    axial_round(bosses, 0, AXIS_Y,
                [(.103,FRONT-.159),(.166,FRONT-.159),(.160,FRONT-.170),
                 (.103,FRONT-.170),(.103,FRONT-.159)], mats["bush"], capped=False)
    bosses.finish("FA130_FRONT_BEARING_AND_COLLAR", parent, closed=False)

    inset = MeshBatch()
    axial_shell(inset,[(.858,.636,FRONT+.120),(.862,.635,.89)],mats["inner"])
    for x in [-.18,.18]:
        inset.box((x,1.408,.684),(.138,.029,.185),mats["stator"],.017)
    inset.finish("FA130_DARK_INTERIOR_BEHIND_VENTS", parent)


def end_cap(parent, mats):
    cap = MeshBatch()
    axial_shell(cap,[(.925,.684,.899),(.955,.714,.953),
                     (.976,.735,1.079),(.987,.737,1.140),
                     (.985,.736,1.211),(.943,.698,BACK)],mats["resin"])
    cap.finish("FA130_MOLDED_REAR_END_CAP", parent)

    ridge = MeshBatch()
    ridge.box((0,1.5015,1.071),(.853,.297,.351),mats["resin"],.065)
    ridge.finish("FA130_REAR_TERMINAL_RIDGE",parent)

    boss = MeshBatch()
    axial_round(boss,0,AXIS_Y,
                [(.113,BACK-.012),(.480,BACK-.012),(.500,1.332),
                 (.481,1.452),(.460,1.480),(.113,1.480),(.113,BACK-.012)],
                mats["resin"],44,False)
    boss.finish("FA130_REAR_JOURNAL_BOSS",parent,closed=False)

    rear = MeshBatch()
    axial_round(rear,0,AXIS_Y,
                [(.105,1.458),(.149,1.458),(.149,1.477),(.105,1.477),(.105,1.458)],
                mats["bush"],36,False)
    rear.box((0,1.002,1.480),(.545,.097,.022),mats["resin_dark"],.043)
    rear.box((0,.352,1.446),(.477,.059,.062),mats["resin_dark"],.025)
    for x in [-.922, .922]:
        rear.box((x,.752,1.052),(.116,.292,.226),mats["rim"],.052)
        rear.box((x*.985,.751,1.164),(.082,.195,.044),mats["rim"],.022)
    for x,y in [(-.593,.535),(.465,1.311)]:
        axial_round(rear,x,y,[(.048,BACK-.009),(.047,BACK+.001)],mats["resin_dark"],20)
    rear.finish("FA130_REAR_BEARING_CLIPS_AND_MOLD_DETAILS",parent,closed=False)


def rear_tabs(parent, mats):
    for polarity, sign in [("Positive",1),("Negative",-1)]:
        # The eye sits inside the upward bend of the 0.1 mm tin-plated strip.
        outline = [(.382,1.502),(.437,1.506),(.593,1.556),(.623,1.564),
                   (.622,1.575),(.588,1.568),(.434,1.517),(.382,1.513)]
        width = len(outline)
        points = [(sign*x,y,TAB_Z+dz) for dz in [-.092,.092] for x,y in outline]
        tab = MeshBatch()
        tab.add(points,[tuple(reversed(range(width))), *loops_faces(width,2),
                        tuple(range(width,width*2))],mats["tin"])
        obj = tab.finish("FA130_"+polarity.upper()+"_SOLDER_TAB",parent)
        obj["Contact center"] = [sign*TAB_X,TAB_Y,TAB_Z]
        drill = MeshBatch()
        drill.cylindrical(sign*TAB_X,TAB_Z,[(.036,1.49),(.036,1.60)],mats["tin"],22,True)
        cut_mesh(obj,drill.finish("Tab eye cutter"))

    polarity_marks = MeshBatch()
    for x in [-.674,.674]:
        polarity_marks.box((x,1.343,1.251),(.110,.018,.007),mats["ink"],.003)
    polarity_marks.box((.674,1.343,1.251),(.017,.110,.007),mats["ink"],.003)
    polarity_marks.finish("FA130_REAR_POLARITY_MARKS",parent)


def rotating_shaft(parent, mats):
    shaft = MeshBatch()
    axial_round(shaft,0,0,
                [(.087,SHAFT_NOSE),(.100,SHAFT_NOSE+.038),(.100,1.57),(.083,REAR_STUD)],
                mats["shaft"],48)
    shaft.finish("FA130_2MM_STEEL_SHAFT",parent)
    mark = MeshBatch()
    # A small teaching mark makes direction legible on an otherwise round shaft.
    axial_round(mark,.035,0,[(.024,SHAFT_NOSE-.0007),(.024,SHAFT_NOSE+.002)],mats["ink"],24)
    cross_section = [(radius*math.cos(angle),radius*math.sin(angle))
                     for radius,steps in [(.1009,range(7)),(.0990,range(6,-1,-1))]
                     for step in steps for angle in [math.radians(35+step*2)]]
    count = len(cross_section)
    mark.add([(x,y,z) for z in [-2.143,-1.905] for x,y in cross_section],
             [tuple(reversed(range(count))), *loops_faces(count,2), tuple(range(count,count*2))],
             mats["ink"])
    mark.finish("FA130_SHAFT_MOTION_MARK",parent)


def studio(output):
    scene = bpy.context.scene
    floor = MeshBatch()
    floor.box((0,-.018,0),(20,.024,20),material("Studio ground","b8c8ce",roughness=.62),0)
    floor.finish("Studio ground")
    scene.world = bpy.data.worlds.new("Soft studio ambient")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.53,.63,.73,1)
    background.inputs["Strength"].default_value = .60
    target = (0,.65,-.23)
    for name,point,energy,size in [("Key",(-3.1,4.7,-4.1),390,4.8),
                                  ("Strip",(3.2,2.5,-2.1),290,3.2),
                                  ("Rim",(1.8,3.5,3.8),360,3.9)]:
        data = bpy.data.lights.new(name,"AREA")
        data.energy,data.shape,data.size = energy,"DISK",size
        light = bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(light)
        light.location = blender_point(point)
        aim(light,blender_point(target))
    data = bpy.data.cameras.new("FA-130RA studio")
    data.type,data.ortho_scale = "ORTHO",4.35
    camera = bpy.data.objects.new("FA-130RA studio",data)
    bpy.context.collection.objects.link(camera)
    camera.location = blender_point((3.76,3.80,-5.65))
    aim(camera,blender_point(target))
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 920
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--render",type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {key:material(name,color,metal,roughness) for key,name,color,metal,roughness in [
        ("steel","Satin zinc-plated steel","afb6b9",.81,.33),
        ("rim","Stamped bright steel","b8bfc2",.86,.27),
        ("shaft","Polished steel shaft","bfc9ce",.91,.22),
        ("bush","Sintered bronze bearings","8e7052",.77,.34),
        ("inner","Shadow behind openings","282c2d",.19,.68),
        ("stator","Ferrite magnet glimpse","343638",.08,.66),
        ("resin","Off-white molded resin","e5e3d8",.02,.46),
        ("resin_dark","Molded recess","a3a29a",.02,.64),
        ("tin","Tin-plated solder terminals","c9c5ae",.67,.34),
        ("ink","Dark identification marks","34383c",.02,.44)]}
    root = empty("FA130_COMMON")
    root["Reference"] = "Mabuchi FA-130RA-18100"
    root["Manufacturer drawing"] = DATASHEET
    root["Units"] = "Numeric centimetres, +Y up, shaft -Z, body base Y=0"
    root["Dimensions"] = "20.1 × 15.1 × 25 mm body; 38 mm overall; 2 mm shaft diameter"
    root["Visual scope"] = "Independent teaching model. Internal details and finishes are approximations."
    body,rotor = empty("FA130_BODY"),empty("FA130_ROTOR")
    body.parent = rotor.parent = root
    rotor.location = blender_point((0,AXIS_Y,0))
    rotor["Rotation axis"] = "+Z"
    steel_can(body,mats)
    end_cap(body,mats)
    rear_tabs(body,mats)
    rotating_shaft(rotor,mats)

    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()),export_format="GLB",
                             export_yup=True,export_extras=True)
    if args.render:
        args.render.parent.mkdir(parents=True,exist_ok=True)
        studio(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
