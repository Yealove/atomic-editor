// @ts-nocheck — demo app, not part of the published package
import { createApp } from 'vue';
import App from './App.vue';
import './demo.css';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createApp(App).mount(root);
