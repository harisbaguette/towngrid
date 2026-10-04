"""Build an editable full-body Mira model and render quarter-view review cels.

Run with Blender --background --python scripts/build-mira-volume.py -- --proof.
No runtime sprites are overwritten. All body parts exist in one 3D scene.
"""
import argparse
import json
import math
from pathlib import Path
import sys
import warnings

import bpy
from mathutils import Vector, Matrix
import numpy as np

warnings.filterwarnings('ignore',category=DeprecationWarning)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from mira_volume_motion import pose, sample, unit, v, STRIDE, PERIOD

SOURCE=ROOT/'art-source/pixel-characters/volume-motion-v10/mira'
OUT=ROOT/'work/mira-volume-render'
REST=pose(0.,'idle')
BOUND=[]
PALETTE={
 'skin':['713d34','b46b4d','e7a674','ffd4a0'],
 'face':['834d3b','ca8d64','f0b887','ffdaa8'],
 'hair':['211a1b','4d2b22','815034','af7546'],
 'hairlight':['38241e','613821','985d35','c1884f'],
 'teal':['101f29','203b49','385f6e','60919a'],
 'tealdark':['101b22','1b313e','2b4856','436b77'],
 'cream':['736553','a6957c','d8c9a9','fff1ce'],
 'leather':['251b1a','4d2c22','79482e','a87643'],
 'leatherlight':['32211c','61402c','95633c','bb8b52'],
 'shorts':['1d1e24','36333a','545057','797079'],
 'gold':['4e3120','866029','bb964c','f0c973'],
 'ink':['171a23']*4,
 'eye':['d4c4a5','e8d9bd','fff1d5','fff6e3'],
 'iris':['271e1b','4a2b20','77432b','9d6540'],
 'wood':['35261d','735039','ab7f4e','d2b279'],
}
MATS={}


def linear(n):
    return n/12.92 if n<=.04045 else ((n+.055)/1.055)**2.4


def color(hex):
    return (*[linear(int(hex[i:i+2],16)/255) for i in [0,2,4]],1.)


def material(name):
    if name in MATS:return MATS[name]
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    nodes=mat.node_tree.nodes;nodes.clear();links=mat.node_tree.links
    output=nodes.new('ShaderNodeOutputMaterial')
    diffuse=nodes.new('ShaderNodeBsdfDiffuse');diffuse.inputs['Color'].default_value=(.8,.8,.8,1)
    rgb=nodes.new('ShaderNodeShaderToRGB');links.new(diffuse.outputs[0],rgb.inputs[0])
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='CONSTANT'
    values=PALETTE[name]
    for p in [.42,.72]:ramp.color_ramp.elements.new(p)
    for element,p,c in zip(ramp.color_ramp.elements,[0.,.30,.52,.76],values):
        element.position=p;element.color=color(c)
    links.new(rgb.outputs['Color'],ramp.inputs[0])
    emission=nodes.new('ShaderNodeEmission');links.new(ramp.outputs[0],emission.inputs[0])
    links.new(emission.outputs[0],output.inputs['Surface'])
    mat.diffuse_color=color(values[2]);MATS[name]=mat
    return mat


def bind(obj,weights):
    groups={name:obj.vertex_groups.new(name=name) for name in {n for w in weights for n in w}}
    for i,w in enumerate(weights):
        for name,value in w.items():
            if value>0:groups[name].add([i],float(value),'REPLACE')
    modifier=obj.modifiers.new('Full body skeleton','ARMATURE');modifier.object=RIG
    BOUND.append(obj)
    return obj


def mesh(name,verts,faces,mat,bone=None,weights=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material(mat))
    for poly in data.polygons:poly.use_smooth=True
    if weights is not None:bind(obj,weights)
    elif bone:bind(obj,[{bone:1.} for _ in verts])
    return obj


def ellipsoid(name,center,scale,mat,bone=None,segments=16,rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=center)
    obj=bpy.context.object;obj.name=name;obj.scale=scale
    bpy.ops.object.transform_apply(location=True,rotation=False,scale=True)
    obj.data.materials.append(material(mat))
    for poly in obj.data.polygons:poly.use_smooth=True
    if bone:bind(obj,[{bone:1.} for _ in obj.data.vertices])
    return obj


def loft(name,rings,mat,bone=None,n=16,weights=None):
    # A ring is (center, x radius, y radius). All share horizontal sections.
    verts=[];faces=[];vw=[]
    for i,(center,rx,ry) in enumerate(rings):
        for j in range(n):
            a=math.tau*j/n
            verts.append((center[0]+rx*math.cos(a),center[1]+ry*math.sin(a),center[2]))
            if weights:vw.append(weights[i])
    for i in range(len(rings)-1):
        for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    faces.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+j for j in range(n))])
    return mesh(name,verts,faces,mat,bone, vw if weights else None)


def tube(name,points,radii,mat,bone,n=12,weights=None):
    verts=[];faces=[];vw=[]
    for i,center in enumerate(points):
        direction=unit(np.array(points[min(i+1,len(points)-1)])-np.array(points[max(0,i-1)]))
        right=unit(np.cross(direction,v(0,1,0)))
        if np.linalg.norm(right)<.1:right=v(1,0,0)
        other=unit(np.cross(direction,right))
        radius=radii[i] if isinstance(radii,list) else radii
        for j in range(n):
            a=math.tau*j/n
            verts.append(tuple(np.array(center)+radius*(math.cos(a)*right+math.sin(a)*other)))
            if weights:vw.append(weights[i])
    for i in range(len(points)-1):
        for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    faces.extend([tuple(reversed(range(n))),tuple((len(points)-1)*n+j for j in range(n))])
    return mesh(name,verts,faces,mat,bone if not weights else None,vw if weights else None)


def box(name,center,size,mat,bone=None,bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    obj=bpy.context.object;obj.name=name;obj.scale=size
    bpy.ops.object.transform_apply(location=True,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new('Rounded seam','BEVEL');mod.width=bevel;mod.segments=2
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(material(mat))
    if bone:bind(obj,[{bone:1.} for _ in obj.data.vertices])
    return obj


def ribbon(name,points,width,mat,bone):
    verts=[]
    for point in points:verts.extend([(point[0]-width/2,point[1],point[2]),(point[0]+width/2,point[1],point[2])])
    faces=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)]
    return mesh(name,verts,faces,mat,bone)


def hair_lock(name,points,widths,mat,bone):
    # Tapered, overlapping sculpted locks, with an actual back-facing surface.
    return tube(name,[v(*p) for p in points],widths,mat,bone,n=10)


def make_rig():
    data=bpy.data.armatures.new('Mira full body')
    rig=bpy.data.objects.new('Mira',data);bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    root=data.edit_bones.new('root');root.head=(0,0,0);root.tail=(0,0,.15)
    for name,(a,b) in REST['bones'].items():
        bone=data.edit_bones.new(name);bone.head=tuple(a);bone.tail=tuple(b);bone.parent=root
    bone=data.edit_bones.new('cargo');bone.head=tuple(REST['cargo']);bone.tail=tuple(REST['cargo']+v(0,0,.2));bone.parent=root
    bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
    return rig


def build_character():
    hipz=REST['bones']['pelvis'][0][2]
    # Fitted undershirt and cropped open jacket, no spheres standing in for arms.
    loft('Cream fitted shirt',[(v(0,0,hipz+.075),.147,.087),(v(0,0,hipz+.18),.132,.087),
         (v(0,-.006,hipz+.32),.181,.112),(v(0,0,hipz+.405),.190,.100),
         (v(0,0,hipz+.465),.10,.075)],'cream','torso')
    # Open jacket: curved side/back panel, leaving the cream front visible.
    verts=[];faces=[];sections=[(.075,.162,.108),(.21,.157,.116),(.36,.203,.136),(.448,.207,.11)]
    angles=np.linspace(-.50,math.pi+.50,21)
    for z,xx,yy in sections:
        for a in angles:verts.append((xx*math.cos(a),yy*math.sin(a),hipz+z))
    for row in range(3):
        for i in range(20):faces.append((row*21+i,row*21+i+1,(row+1)*21+i+1,(row+1)*21+i))
    jacket=mesh('Tailored teal jacket',verts,faces,'teal','torso')
    solid=jacket.modifiers.new('Jacket thickness','SOLIDIFY');solid.thickness=.018
    for side in [-1,1]:
        ribbon('Open jacket lapel',[(side*.148,-.084,hipz+.09),(side*.135,-.108,hipz+.23),
            (side*.129,-.120,hipz+.36),(side*.098,-.089,hipz+.49)],.055,'tealdark','torso')
        ribbon('Shoulder harness',[(side*.133,-.073,hipz+.451),(side*.160,-.127,hipz+.385),
            (side*.145,-.129,hipz+.29),(side*.142,-.113,hipz+.12)],.035,'leather','torso')
        box('Harness buckle',(side*.157,-.143,hipz+.369),(.039,.014,.047),'gold','torso',.004)
        box('Buckle opening',(side*.157,-.153,hipz+.369),(.019,.007,.028),'leather','torso',.002)
    # Neck and rolled scarf collar.
    loft('Neck',[(v(0,0,hipz+.449),.07,.067),(v(0,0,hipz+.555),.065,.063)],'skin','head')
    loft('Cream high collar',[(v(0,-.005,hipz+.437),.102,.091),(v(0,-.005,hipz+.500),.086,.080),
          (v(0,0,hipz+.527),.078,.072)],'cream','torso')
    loft('Shorts waist',[(v(0,0,hipz-.070),.16,.108),(v(0,0,hipz+.065),.157,.102)],'shorts','pelvis')
    loft('Waist belt',[(v(0,0,hipz+.036),.166,.113),(v(0,0,hipz+.080),.161,.107)],'leather','pelvis')
    box('Belt buckle',(0,-.119,hipz+.058),(.065,.025,.057),'gold','pelvis',.005)
    box('Belt buckle inset',(0,-.137,hipz+.058),(.034,.012,.028),'leather','pelvis',.002)
    box('Side tool pouch',(.175,.015,hipz-.025),(.076,.095,.132),'leather','pelvis',.022)
    box('Pouch flap',(.181,-.023,hipz+.025),(.082,.043,.056),'leatherlight','pelvis',.01)
    ellipsoid('Pouch stud',(.18,-.047,hipz+.021),(.011,.005,.011),'gold','pelvis',12,8)
    for label,side in [('L',-1),('R',1)]:
        thigh='thigh.'+label;shin='shin.'+label;footbone='foot.'+label
        h,k=REST['bones'][thigh];_,a=REST['bones'][shin]
        centers=[h,h*.7+k*.3,h*.35+k*.65,k,k*.75+a*.25,k*.4+a*.6,a]
        weights=[{thigh:1},{thigh:1},{thigh:.9,shin:.1},{thigh:.5,shin:.5},
                 {thigh:.08,shin:.92},{shin:1},{shin:1}]
        tube('Continuous leg '+label,centers,[.079,.078,.062,.056,.059,.047,.033],'skin',None,weights=weights)
        tube('Shorts leg '+label,[h+v(0,0,.015),h*.68+k*.32,h*.60+k*.40],[.092,.087,.082],'shorts',thigh)
        tube('Shorts rolled hem '+label,[h*.61+k*.39,h*.56+k*.44],[.086,.084],'cream',thigh)
        # Boot shaft follows shin, the foot and outsole rotate rigidly about ankle.
        shaft_top=a+unit(k-a)*.205
        tube('Boot shaft '+label,[a-v(0,0,.025),a+unit(k-a)*.06,shaft_top],[.064,.065,.077],'leather',shin)
        tube('Boot cuff '+label,[shaft_top-unit(k-a)*.028,shaft_top+unit(k-a)*.012],[.082,.081],'leatherlight',shin)
        # Shaped heel, instep and toe share one continuous rounded silhouette.
        loft('Boot foot '+label,[(a+v(0,-.039,-.097),.069,.125),(a+v(0,-.040,-.069),.071,.127),
             (a+v(0,-.026,-.026),.064,.109),(a+v(0,0,.036),.054,.061)],'leather',footbone)
        loft('Dark boot sole '+label,[(a+v(0,-.043,-.110),.071,.126),(a+v(0,-.043,-.091),.073,.128)],'ink',footbone)
        for z in [.050,.102,.153]:
            point=a+unit(k-a)*z+v(0,-.062,0)
            ribbon('Boot seam '+label,[point+v(-.021,0,-.007),point+v(.021,0,.007)],.01,'leatherlight',shin)
        shoulder,elbow=REST['bones']['upper.'+label];_,wrist=REST['bones']['fore.'+label]
        upper='upper.'+label;fore='fore.'+label
        armpts=[shoulder,shoulder*.65+elbow*.35,shoulder*.20+elbow*.80,elbow,
                elbow*.8+wrist*.2,elbow*.4+wrist*.6,wrist]
        aw=[{upper:1},{upper:1},{upper:.95,fore:.05},{upper:.5,fore:.5},
            {upper:.05,fore:.95},{fore:1},{fore:1}]
        tube('Continuous arm '+label,armpts,[.061,.065,.054,.046,.046,.039,.030],'skin',None,weights=aw)
        tube('Jacket sleeve '+label,[shoulder+v(0,0,.018),shoulder*.65+elbow*.35,shoulder*.16+elbow*.84],
             [.080,.080,.064],'teal',upper)
        tube('Rolled cream sleeve '+label,[shoulder*.22+elbow*.78,shoulder*.02+elbow*.98],
             [.067,.067],'cream',upper)
        emblem=ellipsoid('Guild shoulder emblem '+label,shoulder+v(side*.077,-.016,-.038),(.010,.037,.038),'gold',upper)
        ellipsoid('Guild emblem center '+label,shoulder+v(side*.085,-.016,-.038),(.009,.022,.023),'leather',upper)
        direction=unit(wrist-elbow)
        tube('Glove cuff '+label,[wrist-direction*.034,wrist+direction*.015],[.043,.045],'leatherlight',fore)
        hand='hand.'+label
        tube('Fitted glove '+label,[wrist,wrist+direction*.037,wrist+direction*.074],
             [.035,.039,.029],'leather',hand,n=12)
        thumb=wrist+direction*.03+v(-side*.030,-.005,0)
        ellipsoid('Glove thumb '+label,thumb,(.024,.026,.038),'leather',hand)
        for finger in [-1,0,1]:
            ellipsoid('Glove finger '+label,wrist+direction*.073+v(finger*.018,-.004,0),(.012,.023,.016),'leatherlight',hand,12,8)
    # A sculpted tapered face rather than a spherical toy head.
    neck=REST['bones']['head'][0];z=neck[2]
    loft('Face',[(v(0,-.041,z+.014),.078,.069),(v(0,-.034,z+.063),.143,.114),
         (v(0,-.019,z+.154),.178,.142),(v(0,0,z+.245),.177,.155),
         (v(0,.016,z+.311),.133,.120),(v(0,.018,z+.341),.053,.055)],'face','head',n=24)
    for side in [-1,1]:
        ellipsoid('Ear',(side*.178,-.004,z+.145),(.026,.025,.043),'skin','head')
        ellipsoid('Ear inside',(side*.19,-.024,z+.145),(.013,.008,.024),'leatherlight','head')
        # Eyes sit on the face surface; large iris and upper lid read at 128px.
        ex=side*.073
        ellipsoid('Eye dark contour',(ex,-.158,z+.161),(.041,.013,.041),'ink','head')
        ellipsoid('Eye white',(ex,-.168,z+.154),(.030,.008,.030),'eye','head')
        ellipsoid('Brown iris',(ex-side*.004,-.177,z+.156),(.018,.006,.028),'iris','head')
        ellipsoid('Pupil',(ex-side*.004,-.183,z+.161),(.009,.004,.019),'ink','head')
        ellipsoid('Eye glint',(ex-side*.009,-.188,z+.171),(.006,.004,.008),'eye','head',12,8)
        tube('Upper eyelid',[v(ex-side*.037,-.169,z+.184),v(ex,-.174,z+.193),v(ex+side*.034,-.166,z+.182)],.008,'ink','head',n=8)
        tube('Eyebrow',[v(ex-side*.030,-.15,z+.215),v(ex+side*.024,-.151,z+.220)],.009,'hair','head',n=8)
    ellipsoid('Nose',(0,-.173,z+.112),(.017,.022,.023),'face','head')
    tube('Small smile',[v(-.018,-.149,z+.065),v(0,-.155,z+.061),v(.018,-.15,z+.065)],.0045,'leather','head',n=8)
    # Hair cap leaves the lower face completely open.
    verts=[];faces=[];n=32;m=10
    for row in range(m):
        for j in range(n):
            az=math.tau*j/n
            # front has a higher hairline than sides/back
            bottom=1.42 if math.sin(az)<-.35 else 2.00
            polar=.035+(bottom-.035)*row/(m-1)
            verts.append((.194*math.sin(polar)*math.cos(az),.018+.168*math.sin(polar)*math.sin(az),z+.192+.184*math.cos(polar)))
    for row in range(m-1):
        for j in range(n):faces.append((row*n+j,row*n+(j+1)%n,(row+1)*n+(j+1)%n,(row+1)*n+j))
    mesh('Sculpted hair cap',verts,faces,'hair','head')
    for i in range(5):
        x=-.13+i*.061
        hair_lock('Swept fringe '+str(i),[(x+.045,-.055,z+.343),(x+.015,-.148,z+.295),
             (x-.012,-.175,z+.241),(x-.026,-.167,z+.201+(.023 if i==2 else 0))],
             [.038,.047,.030,.003],'hairlight' if i in [1,3] else 'hair','head')
    for side in [-1,1]:
        hair_lock('Temple lock',[(side*.160,-.073,z+.259),(side*.180,-.097,z+.159),
              (side*.158,-.103,z+.045)], [.041,.035,.008],'hair','head')
    # Keep the approved SD proportions: the face and hair are larger than a
    # realistically proportioned body, while all frames retain one mesh.
    for obj in BOUND:
        if obj.vertex_groups.get('head'):
            for vertex in obj.data.vertices:
                delta=vertex.co-Vector(neck)
                vertex.co=Vector(neck)+Vector((delta.x*1.16,delta.y*1.16,delta.z*1.10))
    pr=REST['bones']['pony'][0]
    ellipsoid('Ponytail tie',pr,(.081,.069,.045),'teal','head')
    for i in range(5):
        off=(i-2)*.027
        hair_lock('Ponytail lock '+str(i),[tuple(pr+v(off,.025,.020)),tuple(pr+v(off*1.8,.10,-.06)),
             tuple(pr+v(off*1.7,.12,-.22)),tuple(pr+v(off*1.1,.065,-.39+(i%2)*.035))],
             [.032,.060,.049,.006],'hairlight' if i in [1,4] else 'hair','pony')


def build_crate():
    global CARGO
    before=set(bpy.data.objects);c=REST['cargo']
    box('Cargo crate',c,(.47,.32,.30),'wood','cargo',.008)
    for x in [-.18,.18]:
        box('Crate upright front',c+v(x,-.17,0),(.042,.024,.32),'leatherlight','cargo',.002)
        box('Crate upright back',c+v(x,.17,0),(.042,.024,.32),'leatherlight','cargo',.002)
    for z in [-.107,0,.107]:
        box('Crate plank seam',c+v(0,-.163,z),(.46,.005,.005),'leather','cargo',.001)
    for side in [-1,1]:
        box('Crate side handle',c+v(side*.24,0,.04),(.011,.09,.034),'ink','cargo',.006)
    CARGO=list(set(bpy.data.objects)-before)


def apply_pose(data,keyframe=None):
    for name,(a,b) in data['bones'].items():
        rest=RIG.data.bones[name]
        rest_rotation=rest.matrix_local.to_3x3()
        if name in data['rotations']:
            # These matrices are absolute changes from the shared rest body.
            rotation=Matrix(data['rotations'][name].tolist())@Matrix(REST['rotations'][name].tolist()).inverted()
        else:
            first=Vector(REST['bones'][name][1]-REST['bones'][name][0])
            second=Vector(b-a)
            rotation=first.rotation_difference(second).to_matrix()
        matrix=(rotation@rest_rotation).to_4x4();matrix.translation=Vector(a)
        bone=RIG.pose.bones[name];bone.matrix=matrix
    bone=RIG.pose.bones['cargo'];rest=RIG.data.bones['cargo']
    matrix=(Matrix(data['bodyRotation'].tolist())@Matrix(REST['bodyRotation'].tolist()).inverted()@rest.matrix_local.to_3x3()).to_4x4()
    matrix.translation=Vector(data['cargo']);bone.matrix=matrix
    bpy.context.view_layer.update()
    if keyframe is not None:
        for bone in RIG.pose.bones:
            bone.rotation_mode='QUATERNION'
            bone.keyframe_insert('location',frame=keyframe)
            bone.keyframe_insert('rotation_quaternion',frame=keyframe)
            bone.keyframe_insert('scale',frame=keyframe)


def setup_scene():
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=scene.render.resolution_y=128
    scene.render.resolution_percentage=100;scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.render.image_settings.color_depth='8';scene.render.filter_size=.01
    scene.render.fps=120;scene.render.fps_base=1
    scene.view_settings.view_transform='Standard'
    scene.world.color=(.12,.12,.12)
    if hasattr(scene,'eevee'):
        if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=16
    bpy.ops.object.light_add(type='SUN',location=(-3,-4,7));light=bpy.context.object
    light.name='Fixed upper-left key';light.data.energy=2.5
    light.rotation_euler=(Vector((0,0,.8))-light.location).to_track_quat('-Z','Y').to_euler()
    light.data.angle=math.radians(8)
    bpy.ops.object.light_add(type='SUN',location=(2,-1,3));light=bpy.context.object
    light.name='Soft fill';light.data.energy=.8
    light.rotation_euler=(Vector((0,0,.8))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();camera=bpy.context.object;camera.name='Quarter view';camera.data.type='ORTHO';camera.data.ortho_scale=2.1
    camera.data.lens=50;scene.camera=camera
    return scene,camera


def set_camera(direction):
    # SW/SE see face, NW/NE see back; fixed 35.264 degree elevation.
    x,y={'SW':(1,-1),'NW':(1,1),'NE':(-1,1),'SE':(-1,-1)}[direction]
    target=Vector((0,0,.89))
    CAMERA.location=target+Vector((x*4,y*4,4))
    CAMERA.rotation_euler=(target-CAMERA.location).to_track_quat('-Z','Y').to_euler()
    right=Vector((-y,x,0)).normalized()
    for name,position in [
        ('Fixed upper-left key',target+Vector((x*3,y*3,5))-right*3),
        ('Soft fill',target+Vector((-x*2,-y*2,4))+right*3),
    ]:
        lamp=bpy.data.objects[name];lamp.location=position
        lamp.rotation_euler=(target-position).to_track_quat('-Z','Y').to_euler()


def render(action,t,direction,path):
    RIG.animation_data_clear()
    apply_pose(sample(action,t))
    carrying=action in ['carry','hold','carryStart','carryStop']
    for obj in CARGO:obj.hide_render=not carrying;obj.hide_viewport=not carrying
    set_camera(direction);SCENE.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--proof',action='store_true')
    parser.add_argument('--actions',default='idle,walk,carry,start,stop,hold,carryStart,carryStop')
    parser.add_argument('--directions',default='SW,NW,NE,SE')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    SOURCE.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    global RIG,SCENE,CAMERA
    RIG=make_rig();build_character();build_crate();SCENE,CAMERA=setup_scene()
    set_camera('SW')
    if args.proof:
        for action,t in [('idle',0),('walk',0),('walk',.25),('walk',.5),('carry',.25)]:
            render(action,t,'SW',OUT/f'proof-{action}-{t}.png')
        render('walk',0,'NW',OUT/'proof-back.png')
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'mira.blend'))
        return
    meta={'id':'mira','revision':'mira-volume-motion-1','method':'full-body-3d-to-pixel',
          'status':'visual-review','runtimeApproved':False,'cell':128,'orthoScale':2.1,
          'strideLength':.5,'modelStride':STRIDE,'cycleSeconds':PERIOD,
          'directions':args.directions.split(','),'clips':{},'source':'mira.blend'}
    # Union of phases needed by 16/24/32-frame clips. No duplicated cels count
    # as extra poses, and all candidates sample exactly the same motion.
    phases=sorted({i/n for n in [16,24,32] for i in range(n)})
    for action in args.actions.split(','):
        samples=phases if action in ['walk','carry'] else [i/24 for i in range(24)] if action in ['idle','hold'] else [i/23 for i in range(24)]
        meta['clips'][action]={'phases':samples,'loop':action in ['walk','carry','idle','hold'],
             'seconds':PERIOD if action in ['walk','carry'] else 2.4 if action in ['idle','hold'] else .48,
             'rootDistances':[sample(action,t)['rootDistance']*.5 for t in samples]}
        for direction in meta['directions']:
            folder=OUT/action/direction;folder.mkdir(parents=True,exist_ok=True)
            for i,t in enumerate(samples):render(action,t,direction,folder/f'{i:03}.png')
    # Editable 120 Hz actions remain in the source blend file.
    for action in meta['clips']:
        RIG.animation_data_create();RIG.animation_data.action=bpy.data.actions.new(action)
        duration=meta['clips'][action]['seconds'];end=round(duration*120)
        for i in range(end+1):apply_pose(sample(action,i/end),i+1)
        RIG.animation_data.action.use_fake_user=True
    RIG.animation_data_clear();apply_pose(pose(0,'idle'))
    for obj in CARGO:obj.hide_render=True;obj.hide_viewport=True
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'mira.blend'))
    (SOURCE/'motion.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
    print('MIRA_VOLUME_RENDER_COMPLETE',flush=True)


if __name__=='__main__':main()
