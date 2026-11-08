"""Build the Espressif ESP32-DevKitC V4 / WROOM-32E fixed-detail Blender asset.

Run from the site root with Blender 4.5 LTS.
  blender -b -t 5 -P tools/blender/esp32_devkitc_v4.py -- --output dist/models/esp32-devkitc-v4-detail.glb
Optional --blend and --render paths write the editable scene and a studio image.

Coordinates are centimetres in the app, with +Y up and the USB mouth toward +Z
in photo orientation. The workbench rotates the fixed assembly 180 degrees and
owns the live headers, buttons, power LED, pin labels and electrical behavior.

References for outline, pitch, and component placement (Espressif Systems):
https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_dimensions.pdf
https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_pcb_layout.pdf
https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_sch.pdf
https://documentation.espressif.com/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.html

This mesh uses nominal dimensions and placements interpreted from the drawings.
The base laminate stack, drill bore, connector mechanics, underside traces and
small component appearance are illustrative. It contains no manufacturing CAD.
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


BOARD_WIDTH, BOARD_LENGTH = 2.794, 4.826
PCB_BOTTOM, PCB_TOP = .21, .35
HEADER_X, HEADER_PITCH, HEADER_BORE = 1.27, .254, .052
MODULE_FRONT = -BOARD_LENGTH / 2 - .604
MODULE_BACK = MODULE_FRONT + 2.55
MODULE_BASE, MODULE_TOP, SHIELD_TOP = .36, .44, .67
SHIELD_CENTER = (0, MODULE_BACK - .105 - 1.76 / 2)
CASTELLATION_PITCH, CASTELLATION_RADIUS = .127, .0275
LAYOUT_X, LAYOUT_Z, LAYOUT_PIXELS_PER_CM = 678, 1099.5, 182
DIMENSION_URL = "https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_dimensions.pdf"
LAYOUT_URL = "https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_pcb_layout.pdf"
MODULE_URL = "https://documentation.espressif.com/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.html"


def board_xy(x, z):
    return ((x - LAYOUT_X) / LAYOUT_PIXELS_PER_CM, (z - LAYOUT_Z) / LAYOUT_PIXELS_PER_CM)


def antenna_track(batch, route, y, width, mat):
    normals = []
    for (x, z), (nx, nz) in zip(route, route[1:]):
        dx, dz = nx - x, nz - z
        length = math.hypot(dx, dz)
        normals.append((-dz / length, dx / length))
    vertices = []
    for i, (x, z) in enumerate(route):
        a = normals[max(0, i - 1)]
        b = normals[min(i, len(normals) - 1)]
        miter = width / (2 * (1 + a[0] * b[0] + a[1] * b[1]))
        dx, dz = (a[0] + b[0]) * miter, (a[1] + b[1]) * miter
        vertices.extend([(x + dx, y, z + dz), (x - dx, y, z - dz)])
    batch.add(vertices, [(i, i + 2, i + 3, i + 1) for i in range(0, len(vertices) - 2, 2)], mat)


def main_board(root, mats):
    contacts = [(x, (i - 9) * HEADER_PITCH) for x in (-HEADER_X, HEADER_X) for i in range(19)]
    base = MeshBatch()
    base.loft([(PCB_BOTTOM, BOARD_WIDTH - .012, BOARD_LENGTH - .012, .095),
               (PCB_BOTTOM + .012, BOARD_WIDTH, BOARD_LENGTH, .102),
               (PCB_TOP - .012, BOARD_WIDTH, BOARD_LENGTH, .102),
               (PCB_TOP, BOARD_WIDTH - .012, BOARD_LENGTH - .012, .095)],
              mats["mask"], sides=[mats["edge"], mats["edge"], mats["edge"]])
    pcb = base.finish("ESP32_PCB_MASK_AND_LAMINATE", root)
    pcb["Nominal millimetres"] = [27.94, 48.26]
    cutter = MeshBatch()
    plating = MeshBatch()
    for x, z in contacts:
        cutter.cylindrical(x, z, [(HEADER_BORE, .16), (HEADER_BORE, .39)], mats["mask"], 24, True)
        profile = [(.077, PCB_BOTTOM - .001), (.054, PCB_BOTTOM - .001),
                   (.0515, PCB_BOTTOM + .008), (.0515, PCB_TOP - .008),
                   (.054, PCB_TOP + .001), (.077, PCB_TOP + .001)]
        vertices = [(x + r * math.cos(a), y, z + r * math.sin(a)) for r, y in profile
                    for a in [i * math.tau / 24 for i in range(24)]]
        plating.add(vertices, loops_faces(24, len(profile)), mats["tin"], True)
    cut_mesh(pcb, cutter.finish("Header bore tools"))
    metal = plating.finish("ESP32_PCB_PLATED_HEADER_HOLES", root, closed=False)
    metal["Header row X positions cm"] = [-HEADER_X, HEADER_X]
    metal["Header positions Z cm"] = [(i - 9) * HEADER_PITCH for i in range(19)]
    metal["Count"] = len(contacts)


def module_board(root, mats):
    left_z = [MODULE_BACK - .15 - CASTELLATION_PITCH * i for i in reversed(range(14))]
    back_x = [(i - 4.5) * CASTELLATION_PITCH for i in range(10)]
    board = MeshBatch()
    center = (0, (MODULE_FRONT + MODULE_BACK) / 2)
    board.loft([(MODULE_BASE, 1.8, 2.55, .006), (MODULE_TOP, 1.8, 2.55, .006)],
               mats["module"], center=center, sides=[mats["module_edge"]])
    substrate = board.finish("ESP32_WROOM_SUBSTRATE", root)
    substrate["Nominal millimetres"] = [18.0, 25.5, 0.8]
    contacts = [(x, z, -math.pi / 2 if x < 0 else math.pi / 2)
                for x in (-.9, .9) for z in left_z]
    contacts.extend((x, MODULE_BACK, math.pi) for x in back_x)

    cutter = MeshBatch()
    solder = MeshBatch()
    for x, z, angle in contacts:
        cutter.cylindrical(x, z, [(CASTELLATION_RADIUS, .33), (CASTELLATION_RADIUS, .46)],
                           mats["module"], 20, True)
        # The gold plated half-cylinder lines the routed edge and opens outward.
        points = [(x + CASTELLATION_RADIUS * math.cos(a), y,
                   z + CASTELLATION_RADIUS * math.sin(a))
                  for y in (MODULE_BASE, MODULE_TOP)
                  for a in [angle + math.pi * i / 10 for i in range(11)]]
        solder.add(points, [(i, i + 1, i + 12, i + 11) for i in range(10)], mats["gold"], True)
        inward_x, inward_z = -math.sin(angle), math.cos(angle)
        solder.box((x + inward_x * .055, MODULE_TOP + .0025, z + inward_z * .055),
                   (.081, .005, .05), mats["gold"], 0, angle)
        solder.box((x - inward_x * .013, PCB_TOP + .0045, z - inward_z * .013),
                   (.087, .009, .135), mats["tin"], 0, angle)
    cut_mesh(substrate, cutter.finish("Castellation router tools"))
    edges = solder.finish("ESP32_WROOM_CASTELLATIONS", root, closed=False)
    edges["Count"] = len(contacts)
    edges["Pitch in mm"] = 1.27

    shield = MeshBatch()
    shield.loft([(.445, 1.56, 1.73, .047), (.47, 1.58, 1.76, .046),
                 (.644, 1.58, 1.76, .045), (.663, 1.552, 1.733, .045),
                 (SHIELD_TOP, 1.521, 1.704, .042)], mats["shield"], center=SHIELD_CENTER,
                sides=[mats["steel_dark"], mats["shield"], mats["steel"], mats["shield"]])
    shield.box((-.697, SHIELD_TOP + .0005, MODULE_BACK - .205),
               (.064, .001, .064), mats["shield_mark"], .028)
    part = shield.finish("ESP32_WROOM_SHIELD", root)
    part["Part"] = "ESP32-WROOM-32E"
    part["Shield centre X and Z cm"] = SHIELD_CENTER
    part["Nominal shield width and depth mm"] = [15.8, 17.6]

    antenna = MeshBatch()
    antenna_end = MODULE_FRONT + .619
    antenna.box((0, MODULE_TOP + .001, (MODULE_FRONT + antenna_end) / 2),
                (1.79, .002, .617), mats["antenna_mask"], .002)
    # Visible meander follows the top-view drawing. It is exterior artwork for teaching.
    near, far, mid = MODULE_FRONT + .068, MODULE_FRONT + .548, MODULE_FRONT + .34
    antenna_track(antenna, [(-.708, far), (-.708, near), (-.470, near), (-.470, mid), (-.238, mid),
                            (-.238, near), (0, near), (0, mid), (.248, mid), (.248, near),
                            (.706, near), (.706, far)], MODULE_TOP + .003, .082, mats["antenna_copper"])
    antenna.ribbon([(.477, near + .041), (.477, far)], MODULE_TOP + .003, .077, mats["antenna_copper"])
    antenna.finish("ESP32_WROOM_ANTENNA", root, closed=False)


def usb_cross_section(z, width, y0, y1):
    half = width / 2
    return [(x, y, z) for x, y in [(-half + .076, y0), (half - .076, y0),
                                    (half, y0 + .074), (half, y1 - .031),
                                    (half - .032, y1), (-half + .032, y1),
                                    (-half, y1 - .031), (-half, y0 + .074)]]


def micro_usb(root, mats):
    # Rolled mouth, full hollow port and its rear shell. USB cable mates from +Z.
    shell = MeshBatch()
    sections = [(2.438, .681, .366, .611), (2.510, .681, .366, .611),
                (2.510, .747, .345, .644), (2.468, .760, .345, .648),
                (1.863, .747, .352, .644), (1.820, .705, .362, .622),
                (1.820, .655, .388, .599), (2.438, .655, .388, .599)]
    positions = [p for values in sections for p in usb_cross_section(*values)]
    seam = [(i + len(positions) - 8, (i + 1) % 8 + len(positions) - 8, (i + 1) % 8, i)
            for i in range(8)]
    shell.add(positions, [*loops_faces(8, len(sections)), *seam], mats["steel"])
    for x in (-.357, .357):
        for z in (1.872, 2.222):
            shell.box((x, .363, z), (.115, .036, .172), mats["tin"], .025)
            shell.box((x, PCB_BOTTOM - .010, z), (.101, .025, .136), mats["tin"], .023)
        shell.box((x * .72, .651, 2.301), (.072, .007, .129), mats["steel_dark"], .024)
    shell.finish("ESP32_USB_MICRO_B_OPEN_SHELL", root)

    contact = MeshBatch()
    contact.box((0, .485, 1.868), (.632, .237, .124), mats["plastic"], .014)
    contact.box((0, .452, 2.151), (.490, .070, .541), mats["usb"], .013)
    for i in range(-2, 3):
        x = i * .065
        contact.box((x, .488, 2.184), (.035, .009, .363), mats["gold"], .004)
        contact.box((x, .363, 1.769), (.040, .021, .124), mats["tin"], .006)
    contact.finish("ESP32_USB_MICRO_B_TONGUE_AND_PINS", root)


def qfn(root, mats):
    x, z = board_xy(678, 1315)
    chip = MeshBatch()
    chip.loft([(.358, .484, .484, .016), (.365, .5, .5, .020),
               (.424, .5, .5, .021), (.435, .477, .477, .019)], mats["mold"], center=(x, z))
    chip.cylindrical(x + .157, z - .157, [(.027, .435), (.027, .4365)], mats["mold_mark"], 12, True)
    for i in range(-3, 4):
        d = i * .05
        for sign in (-1, 1):
            chip.box((x + d, .3545, z + sign * .244), (.025, .015, .065), mats["tin"], 0)
            chip.box((x + sign * .244, .3545, z + d), (.065, .015, .025), mats["tin"], 0)
    obj = chip.finish("ESP32_USB_UART_QFN", root)
    obj["Part"] = "CP2102N-A02-GQFN28"


def sot23(batch, mats, x, z, invert=False):
    direction = -1 if invert else 1
    batch.box((x, .405, z), (.287, .103, .131), mats["mold"], .012)
    for dx, dz in [(-.094, .109), (.094, .109), (0, -.109)]:
        batch.box((x + dx, .370, z + dz * direction), (.062, .039, .089), mats["tin"], .006)


def ldo_and_passives(root, mats):
    power = MeshBatch()
    x, z = board_xy(671, 1189)
    power.loft([(.356, .57, .647, .034), (.385, .599, .672, .032),
                (.502, .599, .672, .031), (.520, .568, .639, .024)], mats["mold"], center=(x, z))
    for pin in (-1, 0, 1):
        pz = z + pin * .230
        power.box((x - .336, .389, pz), (.124, .053, .076), mats["tin"], .008)
        power.box((x - .392, .365, pz), (.075, .027, .087), mats["tin"], .009)
    power.box((x + .343, .368, z), (.221, .034, .365), mats["tin"], .011)
    device = power.finish("ESP32_3V3_REGULATOR", root)
    device["Part"] = "AMS1117-3.3 (SOT-223)"

    parts = MeshBatch()
    sot23(parts, mats, *board_xy(816, 1185))
    sot23(parts, mats, *board_xy(816, 1328), invert=True)
    capacitors = [(537, 1157, .281, .136), (576, 1157, .281, .136),
                  (576, 1222, .281, .136), (537, 1300, .223, .122)]
    small = [(537, 1200), (537, 1219), (537, 1238), (590, 1270), (590, 1286),
             (590, 1304), (590, 1322), (590, 1341), (590, 1359), (759, 1267),
             (759, 1287), (759, 1349), (759, 1368)]
    vertical = [(537, 1350), (581, 1423), (775, 1423), (650, 1396), (676, 1396), (701, 1396)]
    placements = [(x, z, length, width, True, True) for x, z, length, width in capacitors]
    placements += [(x, z, .146, .067, False, i % 4 == 0) for i, (x, z) in enumerate(small)]
    placements += [(x, z, .139, .061, True, i < 3) for i, (x, z) in enumerate(vertical)]
    for x, z, length, width, upright, dielectric in placements:
        x, z = board_xy(x, z)
        angle = math.pi / 2 if upright else 0
        thickness = .071 if length > .2 else .041
        color = mats["ceramic"] if dielectric else mats["mold"]
        parts.box((x, PCB_TOP + thickness / 2, z), (length, thickness, width), color, .008, angle)
        for sign in (-1, 1):
            tip = sign * length * .41
            dx, dz = (0, tip) if upright else (tip, 0)
            parts.box((x + dx, PCB_TOP + thickness / 2, z + dz),
                      (length * .22, thickness + .006, width + .004), mats["tin"], 0, angle)
    parts.finish("ESP32_PASSIVES_AND_AUTO_RESET", root)

    fixed_lands = MeshBatch()
    for px, pz, width, depth in [(533, 1423, .155, .206), (533, 1511, .155, .206),
                                 (823, 1423, .155, .206), (823, 1511, .155, .206)]:
        x, z = board_xy(px, pz)
        fixed_lands.box((x, .353, z), (width, .006, depth), mats["tin"], .005)
    fixed_lands.finish("ESP32_CONTROL_SOLDER_LANDS", root)


def traces(root, mats):
    copper = MeshBatch()
    # Quiet raised traces and vias on the underside, representative of routed FR-4.
    for sign in (-1, 1):
        for i in range(16):
            z = (i - 8) * HEADER_PITCH
            x = (.97 - (i % 4) * .073) * sign
            end_z = z + (.23 if i % 3 else -.16)
            copper.ribbon([(1.19 * sign, z), (1.07 * sign, z), (x, end_z), (x, end_z + .17)],
                          PCB_BOTTOM - .006, .014, mats["trace"])
            copper.cylindrical(x, end_z + .17, [(.022, PCB_BOTTOM - .010),
                               (.022, PCB_BOTTOM - .005)], mats["via"], 12, True)
    copper.finish("ESP32_ILLUSTRATIVE_UNDERSIDE_ROUTING", root, closed=False)


def studio():
    scene = bpy.context.scene
    stage = MeshBatch()
    stage.box((0, .009, 0), (60, .016, 60), material("Studio background", "c6d1d5", 0, .73), 0)
    stage.finish("Evidence ground").hide_set(True)
    scene.world = bpy.data.worlds.new("Studio ambient")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.57, .65, .72, 1)
    background.inputs["Strength"].default_value = .44
    center = (0, .33, -.25)
    for name, point, watts, size in [("Key", (-3, 7, 5), 850, 5),
                                      ("Fill", (5, 5, 1), 430, 4),
                                      ("Rim", (0, 4, -6), 620, 5)]:
        lamp = bpy.data.lights.new(name, "AREA")
        lamp.energy, lamp.shape, lamp.size = watts, "DISK", size
        obj = bpy.data.objects.new(name, lamp)
        bpy.context.collection.objects.link(obj)
        obj.location = blender_point(point)
        aim(obj, blender_point(center))
        obj.hide_set(True)
    camera = bpy.data.cameras.new("Studio camera")
    camera.type, camera.ortho_scale = "ORTHO", 6.4
    obj = bpy.data.objects.new("Studio camera", camera)
    bpy.context.collection.objects.link(obj)
    obj.location = blender_point((3.7, 8.2, 7.6))
    aim(obj, blender_point(center))
    scene.camera = obj
    obj.hide_set(True)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                view = area.spaces.active.region_3d
                view.view_location = Vector(blender_point(center))
                view.view_rotation = obj.rotation_euler.to_quaternion()
                view.view_distance = 6.8
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
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {name: material(name, color, metal, roughness) for name, color, metal, roughness in [
        ("mask", "252828", .02, .55), ("edge", "887448", .04, .66),
        ("module", "294d39", .03, .58), ("module_edge", "666046", .03, .70),
        ("antenna_mask", "333d31", .02, .57), ("antenna_copper", "5b654b", .31, .52),
        ("shield", "b6b7ae", .70, .40), ("shield_mark", "616965", .36, .49),
        ("steel", "b6bfbf", .83, .30), ("steel_dark", "737e7f", .72, .46),
        ("tin", "b6bfc1", .72, .35), ("gold", "c7a461", .73, .35),
        ("mold", "232626", .03, .60), ("mold_mark", "505452", .02, .60),
        ("plastic", "1f2323", .03, .60), ("usb", "363b39", .05, .61),
        ("ceramic", "a89170", .11, .56), ("trace", "303939", .05, .47),
        ("via", "4a5450", .22, .52),
    ]}
    root = empty("ESP32_COMMON")
    root["Variant"] = "Espressif ESP32-DevKitC-32E / ESP32-DevKitC V4"
    root["Board dimensions"] = DIMENSION_URL
    root["Board placement"] = LAYOUT_URL
    root["Module dimensions"] = MODULE_URL
    root["Units"] = "Numeric centimetres, Y up, USB faces +Z"
    root["Appearance"] = "Nominal learning model; small component, connector and underside appearance illustrative."
    main_board(root, mats)
    module_board(root, mats)
    micro_usb(root, mats)
    qfn(root, mats)
    ldo_and_passives(root, mats)
    traces(root, mats)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB",
                              export_yup=True, export_extras=True)
    if args.blend or args.render:
        scene = studio()
    if args.blend:
        bpy.context.preferences.filepaths.save_version = 0
        args.blend.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()))
    if args.render:
        args.render.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
