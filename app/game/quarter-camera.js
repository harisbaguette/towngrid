import * as THREE from 'three';

// Four diagonal views of the square grid. 35.264° elevation is fixed; neither
// mouse nor touch gestures may leave these authored views between turns.
export const QUARTER_TURN = Math.PI / 2;
export const QUARTER_POLAR = Math.acos(1 / Math.sqrt(3));
export const QUARTER_DISTANCE = Math.sqrt(3) * 20;
export const QUARTER_VIEWS = ['남동', '북동', '북서', '남서'];
export const normalizeQuarter = view => ((Math.round(view) % 4) + 4) % 4;
export const quarterAzimuth = view => {
 const angle = Math.PI / 4 + normalizeQuarter(view) * QUARTER_TURN;
 return angle > Math.PI ? angle - Math.PI * 2 : angle;
};

export function configureQuarterControls(controls) {
 controls.enableRotate = false;
 controls.minPolarAngle = controls.maxPolarAngle = QUARTER_POLAR;
 controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
 controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
}

export function settleQuarterControls(controls) {
 // Consume residual pan damping before choosing a new focus point.
 const damping = controls.enableDamping;
 controls.enableDamping = false;
 controls.update();
 controls.enableDamping = damping;
}

export function applyQuarterView(camera, controls, view) {
 const index = normalizeQuarter(view), azimuth = quarterAzimuth(index);
 settleQuarterControls(controls);
 controls.minAzimuthAngle = controls.maxAzimuthAngle = azimuth;
 camera.position.copy(controls.target).add(new THREE.Vector3().setFromSphericalCoords(QUARTER_DISTANCE, QUARTER_POLAR, azimuth));
 camera.lookAt(controls.target);
 controls.update();
 camera.updateMatrixWorld();
 return index;
}
