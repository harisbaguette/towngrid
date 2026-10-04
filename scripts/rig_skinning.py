"""Deform the original limb textures through a shared elbow/knee cross-section.

Independent bone rectangles leave overlapping cut edges when a joint bends.
This strip mesh shares vertices and UVs at each joint, including the fixed
foot orientation. It changes the rig's mapping, never paints replacement art.
"""
import numpy as np
from PIL import Image

SKINNING_REVISION = 'continuous-joints-1'


def unit(vector):
    return vector / max(float(np.linalg.norm(vector)), .001)


def normal(vector):
    return np.array([-vector[1], vector[0]])


def joint_normal(first, second):
    # A miter grows into a long cloth spike at a tightly folded joint.
    # Keep the cross-section at the original width, including prone poses.
    return unit(normal(first) + normal(second))


def limb_layers(limb, root, joint, end, foot_matrix=None):
    """Return upper/lower[/foot] layers with identical UVs in their overlap."""
    a, b, c = np.asarray(limb['joints'], dtype=float)
    source_first, source_second = unit(b-a), unit(c-b)
    first, second = unit(joint-root), unit(end-joint)
    fixed_foot = 'foot' in limb
    names = ['upper', 'lower'] + (['foot'] if fixed_foot else [])
    if '_skin' not in limb:
        images = [np.asarray(limb[name]) for name in names]
        mask = np.logical_or.reduce([image[:, :, 3] > 0 for image in images])
        ys, xs = np.where(mask)
        points = np.stack((xs+.5, ys+.5), axis=-1)
        if not len(points):
            return [Image.new('RGBA', limb['upper'].size) for _ in names]
        def distance(start, finish):
            delta = finish-start
            t = np.clip(((points-start) @ delta) / np.dot(delta, delta), 0, 1)
            return np.linalg.norm(points-start-t[:, None]*delta, axis=1)
        width = float(np.minimum(distance(a, b), distance(b, c)).max()) + 2
        before = max(2., float(-((points-a) @ source_first).min()) + 2)
        after = max(2., float(((points-c) @ source_second).max()) + 2)
        centers = [a-source_first*before, a, b, c, c+source_second*after]
        normals = [normal(source_first), normal(source_first),
                   joint_normal(source_first, source_second), normal(source_second), normal(source_second)]
        vertices = np.array([center + side*width*n for center, n in zip(centers, normals) for side in [-1, 1]])
        limb['_skin'] = images, vertices, width, before, after
    images, source, width, before, after = limb['_skin']
    end_axis = source_second if fixed_foot else second
    centers = [root-first*before, root, joint, end, end+end_axis*after]
    normals = [normal(first), normal(first), joint_normal(first, second), normal(end_axis), normal(end_axis)]
    target = np.array([center + side*width*n for center, n in zip(centers, normals) for side in [-1, 1]])
    height, size = images[0].shape[:2]
    source_mask = np.logical_or.reduce([image[:, :, 3] > 0 for image in images])
    source_x = np.full((height, size), -1, dtype=int)
    source_y = np.zeros((height, size), dtype=int)
    for segment in range(4):
        start = segment*2
        for indices in [[start, start+1, start+2], [start+1, start+3, start+2]]:
            dst, src = target[indices], source[indices]
            matrix = np.column_stack((dst[1]-dst[0], dst[2]-dst[0]))
            if abs(np.linalg.det(matrix)) < .0001:
                continue
            left, top = np.maximum(0, np.floor(dst.min(axis=0)).astype(int))
            right, bottom = np.minimum([size, height], np.ceil(dst.max(axis=0)).astype(int))
            if left >= right or top >= bottom:
                continue
            y, x = np.mgrid[top:bottom, left:right]
            xy = np.stack((x+.5, y+.5), axis=-1)
            weights = (xy-dst[0]) @ np.linalg.inv(matrix).T
            inside = (weights.min(axis=-1) >= -1e-7) & (weights.sum(axis=-1) <= 1+1e-7)
            uv = src[0] + weights @ np.array([src[1]-src[0], src[2]-src[0]])
            sx, sy = np.floor(uv).astype(int).transpose(2, 0, 1)
            valid = inside & (sx >= 0) & (sy >= 0) & (sx < size) & (sy < height)
            visible = valid & source_mask[np.clip(sy, 0, height-1), np.clip(sx, 0, size-1)]
            source_x[y[visible], x[visible]] = sx[visible]
            source_y[y[visible], x[visible]] = sy[visible]
    # Folded strips can overlap. Select one UV for the whole limb before
    # splitting its layers, so transparent pixels cannot expose another UV.
    visible = source_x >= 0
    outputs = []
    for image in images:
        output = np.zeros_like(image)
        output[visible] = image[source_y[visible], source_x[visible]]
        outputs.append(Image.fromarray(output))
    if limb.get('rigidFoot') and fixed_foot:
        # The sole is a rigid piece of the source painting. The calf overlaps
        # it at the ankle, but never shears the boot through the knee mesh.
        matrix=np.array(foot_matrix) if foot_matrix is not None else np.eye(2)
        inverse=np.linalg.inv(matrix)
        origin=c-inverse@end
        outputs[-1]=limb['foot'].transform(limb['foot'].size,Image.Transform.AFFINE,
            (*inverse[0],origin[0],*inverse[1],origin[1]),Image.Resampling.NEAREST)
    return outputs
