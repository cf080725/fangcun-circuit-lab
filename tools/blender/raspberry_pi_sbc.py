"""Build the Raspberry Pi 4B, 5 and Zero 2 W bench models in Blender 4.5 LTS.

  blender -b -t 4 -P tools/blender/raspberry_pi_sbc.py -- --output-dir dist/models

The workbench reads numeric GLB coordinates as centimetres, with +Y up,
the 40-pin header along -Z and the Pi 4B/5 Ethernet mouth facing +X.
The Zero 2 W model is the official variant with the populated GPIO header.
Main dimensions, mounting holes, port positions and header pitch follow:
https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-mechanical-drawing.pdf
https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-mechanical-drawing.pdf
https://datasheets.raspberrypi.com/rpizero2/raspberry-pi-zero-2-w-mechanical-drawing.pdf
https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#40-pin-gpio-header
Component exteriors, traces, shells and solder joints are visual reconstructions.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, blender_point, cut_mesh, empty, loops_faces, material


PCB_BASE, PCB_TOP = .18, .34
HEADER_PITCH, HEADER_TIP = .254, 1.19
MOUNT_RADIUS, CONTACT_RADIUS = .135, .054
SPECS = {
    "raspberry-pi-4": (8.5, 5.6, .30, "Raspberry Pi 4 Model B", "BCM2711"),
    "raspberry-pi-5": (8.5, 5.6, .30, "Raspberry Pi 5", "BCM2712"),
    "pi-zero-2-w": (6.5, 3.0, .30, "Raspberry Pi Zero 2 W", "RP3A0"),
}


def make_materials():
    values = {
        "mask": ("1b784f", .10, .37),
        "edge": ("95a975", .03, .62),
        "core": ("a09259", .06, .62),
        "pad": ("c5a971", .71, .38),
        "gold": ("ebc374", .78, .31),
        "steel": ("b5bdc1", .80, .27),
        "steel_dark": ("7e8a8a", .68, .40),
        "tin": ("a4afb0", .62, .38),
        "dark": ("22272b", .07, .47),
        "black": ("101519", .06, .53),
        "fiber": ("c2bdb1", .05, .64),
        "blue": ("1373a7", .07, .37),
        "green": ("63a45b", .12, .38),
        "amber": ("c6a249", .14, .37),
        "capacitor": ("a68768", .12, .54),
        "silk": ("dce7d4", .03, .60),
        "chip_print": ("b8c5c7", .06, .54),
        "lid_print": ("424e50", .08, .57),
    }
    return {name: material(name, *options) for name, options in values.items()}


def header_contacts(width, depth):
    first_x = 3.25 - width / 2 - 9.5 * HEADER_PITCH
    for column in range(20):
        x = first_x + column * HEADER_PITCH
        for offset in (HEADER_PITCH / 2, -HEADER_PITCH / 2):
            yield x, .35 - depth / 2 + offset


def mounting_positions(width, depth):
    return [
        (left - width / 2, z)
        for left in (.35, 6.15)
        for z in (.35 - depth / 2, depth / 2 - .35)
    ]


def annulus(batch, x, z, inner, outer, low, high, mat, sides=24):
    profile = ((outer, low), (outer, high), (inner, high), (inner, low))
    points = [(x+r*math.cos(angle), y, z+r*math.sin(angle))
              for r, y in profile for angle in (i*math.tau/sides for i in range(sides))]
    faces = loops_faces(sides, len(profile))
    last = sides * (len(profile)-1)
    faces.extend((last+i,last+(i+1)%sides,(i+1)%sides,i) for i in range(sides))
    batch.add(points, faces, mat)


def pcb(root, mats, width, depth, corner, mounting, contacts, fan):
    batch = MeshBatch()
    batch.loft([(PCB_BASE, width, depth, corner),
                (PCB_BASE+.012, width, depth, corner),
                (PCB_TOP-.012, width, depth, corner),
                (PCB_TOP, width, depth, corner)], mats["mask"],
               sides=[mats["edge"], mats["core"], mats["edge"]])
    board = batch.finish("PI_SBC_PCB", root)
    board["Nominal PCB dimensions mm"] = [width*10, depth*10, (PCB_TOP-PCB_BASE)*10]
    tools = MeshBatch()
    for radius, locations, segments in (
        (MOUNT_RADIUS, mounting, 32), (CONTACT_RADIUS, contacts, 12), (.15, fan, 24)
    ):
        for x, z in locations:
            tools.cylindrical(x, z, [(radius, PCB_BASE-.03), (radius, PCB_TOP+.03)],
                              mats["mask"], segments, True)
    cut_mesh(board, tools.finish("PI_SBC_DRILL_TOOLS"))
    for x, z in mounting + fan + [contacts[0], contacts[-1]]:
        hit, *_ = board.ray_cast(Vector(blender_point((x, PCB_TOP+.08, z))), Vector((0, 0, -1)))
        if hit:
            raise RuntimeError(f"Missing PCB drill at {(x, z)}")
    rings = MeshBatch()
    for x, z in mounting:
        annulus(rings, x, z, MOUNT_RADIUS-.001, .267, PCB_BASE-.002, PCB_TOP+.002, mats["pad"], 32)
    rings.finish("PI_SBC_MOUNT_RINGS", root)
    return board


def gpio(root, mats, contacts):
    base, posts, pads = MeshBatch(), MeshBatch(), MeshBatch()
    first_x, first_z = contacts[0]
    center_x = first_x+9.5*HEADER_PITCH
    center_z = first_z-HEADER_PITCH/2
    base.box((center_x, PCB_TOP+.116, center_z), (5.08, .232, .50), mats["black"], .020)
    for index, (x, z) in enumerate(contacts):
        base.box((x, PCB_TOP+.224, z), (.144, .032, .144), mats["dark"], 0)
        post = [(x+dx*side,y,z+dz*side)
                for y,side in ((.12,.032),(HEADER_TIP-.044,.032),(HEADER_TIP,.019))
                for dx,dz in ((-1,-1),(1,-1),(1,1),(-1,1))]
        posts.add(post,[tuple(reversed(range(4))),*loops_faces(4,3),tuple(range(8,12))],mats["gold"])
        annulus(pads, x, z, CONTACT_RADIUS-.001, .082, PCB_BASE-.002, PCB_TOP+.002, mats["gold"], 12)
        if index == 0:
            pads.box((x,PCB_TOP+.004,z+.111), (.168,.008,.022), mats["silk"], 0)
    base.finish("PI_SBC_GPIO_HOUSING", root)
    contact_mesh = posts.finish("PI_SBC_GPIO_POSTS", root)
    contact_mesh["Pin count"] = 40
    contact_mesh["Pin pitch mm"] = 2.54
    contact_mesh["Pin 1 workbench cm"] = [first_x, HEADER_TIP, first_z]
    pads.finish("PI_SBC_GPIO_PLATING", root)


def print_text(root, mats, text, x, y, z, size=.15, kind="silk"):
    curve = bpy.data.curves.new("Silkscreen", "FONT")
    curve.body = text
    curve.size = size
    curve.space_character = 1.10
    curve.materials.append(mats[kind])
    obj = bpy.data.objects.new("PI_SBC_DETAIL_" + text, curve)
    bpy.context.collection.objects.link(obj)
    obj.parent = root
    obj.location = blender_point((x,y,z))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")


def package(root, mats, key, label, x, z, width, depth, lid=False):
    batch = MeshBatch()
    batch.box((x, PCB_TOP+.032, z), (width, .064, depth), mats["dark"], .024)
    batch.box((x, PCB_TOP+.083, z), (width-.08, .060, depth-.08),
              mats["steel_dark"] if lid else mats["black"], .025)
    batch.cylindrical(x-width*.36, z-depth*.36, [(.025,PCB_TOP+.112),(.025,PCB_TOP+.114)],
                      mats["chip_print"], 14, True)
    batch.finish(key, root)
    print_text(root, mats, label, x-width*.35, PCB_TOP+.115, z+.054, min(.18,width*.15),
               "lid_print" if lid else "chip_print")


def wall_box(batch, x, z, face, u, y, v, width, height, depth, mat, bevel=0):
    # u runs across the connector mouth and v runs from its opening into the body.
    if face == "right":
        batch.box((x-v,y,z+u), (depth,height,width), mat, bevel)
    elif face == "left":
        batch.box((x+v,y,z+u), (depth,height,width), mat, bevel)
    else:
        batch.box((x+u,y,z-v), (width,height,depth), mat, bevel)


def metal_port(root, mats, name, x, z, face, width, height, depth, *,
               base=PCB_TOP, tongue="black", pins=5, contact="center"):
    port = MeshBatch()
    lip = min(.037, height*.13)
    wall_box(port,x,z,face,0,base+lip/2,depth/2,width,lip,depth,mats["steel"])
    wall_box(port,x,z,face,0,base+height-lip/2,depth/2,width,lip,depth,mats["steel"])
    for sign in (-1,1):
        wall_box(port,x,z,face,sign*(width-lip)/2,base+height/2,depth/2,lip,height,depth,mats["steel"])
        wall_box(port,x,z,face,sign*(width/2+.024),base+.027,depth*.72,.067,.054,depth*.30,mats["tin"])
    wall_box(port,x,z,face,0,base+height/2,depth*.93,width-lip*2,height-lip*2,depth*.12,mats["black"])
    tongue_y = base+height*(.67 if contact == "top" else .46)
    wall_box(port,x,z,face,0,tongue_y,depth*.57,width*.68,height*.18,depth*.66,mats[tongue])
    pitch = width*.56 / max(pins-1, 1)
    for i in range(pins):
        u = (i-(pins-1)/2)*pitch
        wall_box(port,x,z,face,u,tongue_y+height*.094,depth*.42,min(.047,pitch*.62),.011,
                 depth*.26,mats["gold"],0)
    port.finish("PI_SBC_" + name, root)


def stacked_usb(root, mats, z, blue):
    for layer in range(2):
        metal_port(root,mats,("USB3" if blue else "USB2") + f"_SHELL_{layer+1}",
                   4.55,z,"right",1.28,.72,1.76,base=PCB_TOP+.06+layer*.76,
                   tongue="blue" if blue else "black",pins=9 if blue else 4,contact="top")


def ethernet(root, mats, z):
    metal_port(root,mats,"ETHERNET_OPEN_SHELL",4.55,z,"right",1.55,1.35,2.14,pins=8,contact="top")
    detail = MeshBatch()
    for sign, lens in ((-1,"green"),(1,"amber")):
        wall_box(detail,4.551,z,"right",sign*.625,PCB_TOP+.18,.012,.15,.13,.052,mats[lens])
    detail.finish("PI_SBC_ETHERNET_LEDS", root)


def ffc(root, mats, name, x, z, width, angle=0, pins=15):
    connector = MeshBatch()
    connector.box((x, PCB_TOP+.125, z), (width,.25,.43), mats["fiber"], .020,angle)
    side_x = math.sin(angle)
    side_z = math.cos(angle)
    connector.box((x+side_x*.185, PCB_TOP+.163, z+side_z*.185),
                  (width*.91,.126,.13), mats["dark"], .015,angle)
    for i in range(pins):
        step = (i-(pins-1)/2)*(width*.81/pins)
        px, pz = math.cos(angle)*step, -math.sin(angle)*step
        connector.box((x+px-side_x*.18,PCB_TOP+.028,z+pz-side_z*.18),
                      (.027,.028,.16),mats["tin"],0,angle)
    connector.finish("PI_SBC_" + name, root)


def jack(root, mats):
    audio = MeshBatch()
    audio.box((1.14,PCB_TOP+.30,2.52),(.63,.60,.64),mats["dark"],.035)
    body = audio.finish("PI_SBC_AUDIO_JACK",root)
    cutter = MeshBatch()
    radius, x, y = .174, 1.14, PCB_TOP+.31
    points = [(x+radius*math.cos(a),y+radius*math.sin(a),z)
              for z in (2.56,2.90) for a in (i*math.tau/24 for i in range(24))]
    cutter.add(points,[tuple(reversed(range(24))),*loops_faces(24,2),tuple(range(24,48))],mats["dark"])
    cut_mesh(body,cutter.finish("PI_SBC_AUDIO_DRILL"))


def sd_slot(root, mats, x, z, face):
    metal_port(root,mats,"MICROSD_SHELL",x,z,face,1.42,.148,1.50,base=.018,pins=8)


def passives(root, mats, clusters):
    batch = MeshBatch()
    for x, z, nx, nz, dx, dz in clusters:
        for row in range(nz):
            for column in range(nx):
                i = row*nx+column
                cx, cz = x+column*dx, z+row*dz
                width, depth = (.11,.063) if i % 4 else (.16,.093)
                batch.box((cx,PCB_TOP+.028,cz),(width,.052,depth),
                          mats["capacitor" if i%3 else "dark"],0)
                for end in (-1,1):
                    batch.box((cx+end*width*.39,PCB_TOP+.012,cz),(.041,.024,depth+.018),mats["tin"],0)
    batch.finish("PI_SBC_DETAIL_SURFACE_PASSIVES",root)


def pi4(root, mats):
    package(root,mats,"PI_SBC_MAIN_PACKAGE","BCM2711",-1.32,-.45,1.50,1.50,True)
    package(root,mats,"PI_SBC_MEMORY_PACKAGE","LPDDR4",.23,-.45,1.15,1.50)
    package(root,mats,"PI_SBC_WLAN_SHIELD","WLAN",-3.05,-1.46,1.06,1.29,True)
    package(root,mats,"PI_SBC_USB_CONTROLLER","VL805",1.70,.40,.82,.82)
    package(root,mats,"PI_SBC_ETHERNET_CONTROLLER","PHY",1.61,-1.00,.59,.61)
    package(root,mats,"PI_SBC_POWER_CONTROLLER","PMIC",-3.32,1.57,.51,.52)
    ethernet(root,mats,-1.775)
    stacked_usb(root,mats,.10,True)
    stacked_usb(root,mats,1.90,False)
    metal_port(root,mats,"USB_C_POWER",-3.13,2.92,"front",.89,.32,.80,pins=12)
    metal_port(root,mats,"MICRO_HDMI_0",-1.65,2.92,"front",.66,.30,.80,pins=9)
    metal_port(root,mats,"MICRO_HDMI_1",-.30,2.92,"front",.66,.30,.80,pins=9)
    jack(root,mats)
    ffc(root,mats,"DISPLAY_DSI",-3.83,-.22,1.95,math.pi/2)
    ffc(root,mats,"CAMERA_CSI",.42,1.67,2.16,math.pi/2)
    sd_slot(root,mats,-4.34,.23,"left")
    passives(root,mats,[(-3.80,1.00,5,4,.21,.22),(.84,.82,3,3,.22,.19),
                        (2.06,1.28,3,4,.22,.20),(-2.50,.95,5,2,.25,.24),(-.65,-1.48,4,2,.21,.18)])


def pi5(root, mats):
    package(root,mats,"PI_SBC_MAIN_PACKAGE","BCM2712",-.93,.51,1.70,1.70,True)
    package(root,mats,"PI_SBC_MEMORY_PACKAGE","LPDDR4X",-.93,-1.11,1.46,1.00)
    package(root,mats,"PI_SBC_IO_CONTROLLER","RP1",1.59,-.70,1.22,1.20)
    package(root,mats,"PI_SBC_WLAN_SHIELD","WLAN",-3.01,-1.42,1.06,1.31,True)
    package(root,mats,"PI_SBC_POWER_CONTROLLER","PMIC",-3.14,1.27,.62,.59)
    package(root,mats,"PI_SBC_ETHERNET_CONTROLLER","PHY",2.15,.47,.61,.61)
    stacked_usb(root,mats,-1.90,False)
    stacked_usb(root,mats,-.11,True)
    ethernet(root,mats,1.78)
    metal_port(root,mats,"USB_C_POWER",-3.13,2.93,"front",.89,.41,.78,pins=12)
    metal_port(root,mats,"MICRO_HDMI_0",-1.67,2.93,"front",.66,.34,.81,pins=9)
    metal_port(root,mats,"MICRO_HDMI_1",-.33,2.93,"front",.66,.34,.81,pins=9)
    ffc(root,mats,"MIPI_0",.62,1.95,1.55,math.pi/2,pins=22)
    ffc(root,mats,"MIPI_1",1.25,1.95,1.55,math.pi/2,pins=22)
    ffc(root,mats,"PCIE_FFC",-3.93,-.20,1.08,math.pi/2,pins=16)
    ffc(root,mats,"FAN_CONNECTOR",2.43,-2.41,.60,math.pi/2,pins=4)
    sd_slot(root,mats,-4.39,.44,"left")
    control = MeshBatch()
    control.box((-4.18,PCB_TOP+.10,1.47),(.27,.20,.28),mats["steel_dark"],.012)
    control.box((-4.31,PCB_TOP+.10,1.47),(.16,.10,.16),mats["black"],.011)
    control.box((-4.13,PCB_TOP+.06,.93),(.18,.12,.23),mats["fiber"],.012)
    for x in (1.83,2.08):
        for z in (1.74,1.99):
            control.box((x,PCB_TOP+.29,z),(.063,.58,.063),mats["gold"],.005)
    control.finish("PI_SBC_POWER_BUTTON_RTC_AND_POE",root)
    passives(root,mats,[(-3.80,.47,4,2,.21,.23),(-3.62,1.71,5,2,.23,.21),
                        (.03,-1.64,4,2,.20,.20),(1.03,.47,4,4,.21,.21),(-2.57,-.66,3,3,.23,.21)])


def zero(root, mats):
    package(root,mats,"PI_SBC_MAIN_PACKAGE","RP3A0",-.52,.09,1.50,1.50)
    package(root,mats,"PI_SBC_WLAN_SHIELD","WLAN",1.13,.14,1.24,1.24,True)
    package(root,mats,"PI_SBC_POWER_CONTROLLER","PMIC",2.11,.76,.45,.45)
    metal_port(root,mats,"MINI_HDMI",-2.01,1.62,"front",1.10,.30,.74,pins=12)
    metal_port(root,mats,"MICRO_USB_OTG",.89,1.64,"front",.78,.27,.65,pins=5)
    metal_port(root,mats,"MICRO_USB_POWER",2.15,1.64,"front",.78,.27,.65,pins=5)
    ffc(root,mats,"CAMERA_CSI",3.05,.01,1.63,math.pi/2,pins=22)
    sd_slot(root,mats,-3.29,-.17,"left")
    antenna = MeshBatch()
    for length, center in ((.38,-2.58),(.32,-2.55),(.27,-2.52),(.21,-2.49)):
        index = round((.38-length)/.056)
        antenna.box((center,PCB_TOP+.004,-.57+index*.075),(length,.008,.025),mats["pad"],0)
    antenna.finish("PI_SBC_DETAIL_RF_ANTENNA",root)
    passives(root,mats,[(-1.66,-.55,3,4,.17,.16),(.37,-.59,3,4,.16,.18),
                        (1.86,-.47,3,3,.19,.16),(-2.68,.40,4,3,.20,.18)])


def solder_detail(root, mats, width, depth, contacts):
    underside, leds = MeshBatch(), MeshBatch()
    for index in range(11):
        x = -width*.32+index*width*.049
        z = depth*(.06 + (index%4)*.078)
        underside.box((x,PCB_BASE-.012,z),(.14,.022,.079),mats["tin"],0)
        if index % 2:
            underside.box((x,PCB_BASE-.020,z),(.090,.036,.068),mats["dark"],0)
    underside.finish("PI_SBC_DETAIL_UNDERSIDE",root)
    for x,z in [(-width*.49,depth*.34),(-width*.49,depth*.39)]:
        leds.box((x,PCB_TOP+.029,z),(.113,.054,.083),mats["fiber"],.012)
        leds.box((x,PCB_TOP+.058,z),(.066,.009,.053),mats["green"],.007)
    leds.finish("PI_SBC_STATUS_LED_PACKAGES",root)
    x,z = contacts[0]
    print_text(root,mats,"1",x-.06,PCB_TOP+.007,z+.30,.15)
    print_text(root,mats,"GPIO",x+.26,PCB_TOP+.007,z+.30,.13)


def export_board(board_id, output_dir):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    width, depth, radius, name, mcu = SPECS[board_id]
    materials = make_materials()
    contacts = list(header_contacts(width,depth))
    root = empty("PI_SBC_COMMON")
    root["Board ID"] = board_id
    root["Model title"] = name + (" with headers" if board_id == "pi-zero-2-w" else "")
    root["Processor package"] = mcu
    fan_mounts = [(1.90,-1.85),(-3.90,1.85)] if board_id == "raspberry-pi-5" else []
    pcb(root,materials,width,depth,radius,mounting_positions(width,depth),contacts,fan_mounts)
    gpio(root,materials,contacts)
    variants = {"raspberry-pi-4":pi4, "raspberry-pi-5":pi5, "pi-zero-2-w":zero}
    variants[board_id](root,materials)
    solder_detail(root,materials,width,depth,contacts)
    board_print = (-1.04, .99, .16) if board_id == "pi-zero-2-w" else (-2.07, 1.77, .19)
    x,z,size = board_print
    print_text(root,materials,name,x,PCB_TOP+.007,z,size)
    output = output_dir / (board_id+".glb")
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", export_extras=True)
    print(f"Exported {output} ({output.stat().st_size} bytes)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--board", choices=tuple(SPECS))
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    for board_id in [args.board] if args.board else SPECS:
        export_board(board_id, output_dir)


if __name__ == "__main__":
    main()
