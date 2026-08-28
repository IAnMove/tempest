"""Renderiza un GLB a un sprite PNG cenital con fondo transparente.

Uso:
  blender --background --python render_sprite.py -- ENTRADA.glb SALIDA.png [ROT_Z_GRADOS] [TAM]

Convención del sprite: sujeto centrado, mirando hacia ARRIBA en la imagen
(frente del modelo en +Y de Blender). ROT_Z permite corregir la orientación.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src = os.path.abspath(argv[0])
dst = os.path.abspath(argv[1])
rot_z = math.radians(float(argv[2])) if len(argv) > 2 else 0.0
size = int(argv[3]) if len(argv) > 3 else 512

# escena limpia
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise RuntimeError('sin mallas en ' + src)

# centrar en el origen
bpy.context.view_layer.update()

min_v = Vector((1e9, 1e9, 1e9))
max_v = Vector((-1e9, -1e9, -1e9))
for o in meshes:
    for corner in o.bound_box:
        w = o.matrix_world @ Vector(corner)
        min_v = Vector(map(min, min_v, w))
        max_v = Vector(map(max, max_v, w))
center = (min_v + max_v) / 2
dim = max(max_v.x - min_v.x, max_v.y - min_v.y, max_v.z - min_v.z)

for o in meshes:
    o.location -= center
bpy.context.view_layer.update()

# cámara ortográfica cenital (mira hacia -Z, arriba de la imagen = +Y)
# ROT_Z se aplica como giro de la cámara sobre sí misma: rota al sujeto
# dentro de la imagen sin tocar el modelo.
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = dim * 1.15
cam_data.clip_start = dim * 0.01   # modelos Meshy pueden ser diminutos
cam_data.clip_end = dim * 10
cam = bpy.data.objects.new('cam', cam_data)
cam.location = (0, 0, dim * 2)
cam.rotation_euler = (0, 0, rot_z)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

# luz solar cenital + ambiente
sun_data = bpy.data.lights.new('sun', type='SUN')
sun_data.energy = 3.0
sun = bpy.data.objects.new('sun', sun_data)
sun.rotation_euler = (math.radians(15), math.radians(10), 0)
bpy.context.scene.collection.objects.link(sun)
world = bpy.data.worlds.new('world')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.6, 0.6, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = size
scene.render.resolution_y = size
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = dst

bpy.ops.render.render(write_still=True)
print('SPRITE OK:', dst)
