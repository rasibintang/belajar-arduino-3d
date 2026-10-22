import * as THREE from 'three';
import { createMotor } from '../parts/motor.js';

export default {
  type: 'dc-motor',
  name: 'Motor DC',
  category: 'motor',
  icon: 'motor',
  desc: 'Berputar saat ada beda tegangan di kedua terminalnya. Pin Arduino terlalu lemah — pakai transistor.',
  surface: 'floor',
  create: () => createMotor(),
  pins: (props, group) => [
    { id: '+', name: 'Terminal +', at: group.userData.terminals.plus.position.clone().add(new THREE.Vector3(0, -2, 0)) },
    { id: '-', name: 'Terminal −', at: group.userData.terminals.minus.position.clone().add(new THREE.Vector3(0, -2, 0)) },
  ],
  behavior: { kind: 'dc-motor', plus: '+', minus: '-' },
};
