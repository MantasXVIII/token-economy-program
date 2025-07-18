// src/server/index.js
import jwt from 'jsonwebtoken';
import { UI_HTML } from '../utils/ui_html.js';

const DEFAULT_GRID = {
  Monday: {},
  Tuesday: {},
  Wednesday: {},
  Thursday: {},
  Friday: {},
  Saturday: {},
  Sunday: {}
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    console.log(`Request for: ${url.pathname}`); // Debugging log

    async function authenticate() {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        return decoded;
      } catch (e) {
        return new Response('Invalid token', { status: 401 });
      }
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(UI_HTML, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (url.pathname === '/css/styles.css' && request.method === 'GET') {
      const css = await env.GRID_KV.get('styles.css', { type: 'text' });
      if (!css) {
        console.log('CSS not found in KV');
        return new Response('CSS not found', { status: 404 });
      }
      return new Response(css, {
        headers: { 'Content-Type': 'text/css' },
      });
    }

    if (url.pathname === '/js/app.js' && request.method === 'GET') {
      const js = await env.GRID_KV.get('app.js', { type: 'text' });
      if (!js) {
        console.log('JS not found in KV');
        return new Response('JS not found', { status: 404 });
      }
      return new Response(js, {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }

    if (url.pathname === '/tasks' && request.method === 'GET') {
      const tasks = await env.GRID_KV.get('tasks.json', { type: 'json' });
      if (!tasks) {
        console.log('Tasks not found in KV');
        return new Response('Tasks not found', { status: 404 });
      }
      return new Response(JSON.stringify(tasks), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ... (rest of the fetch logic remains the same)

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    if (event.cron === '0 0 * * 0') {
      const currentGrid = await env.GRID_KV.get('grid/current', { type: 'json' }) || JSON.parse(JSON.stringify(DEFAULT_GRID));
      const date = new Date();
      date.setDate(date.getDate() - date.getDay());
      const weekKey = `history/${date.toISOString().split('T')[0]}`;
      await env.GRID_KV.put(weekKey, JSON.stringify(currentGrid));
      const tasks = await env.GRID_KV.get('tasks.json', { type: 'json' });
      const newGrid = JSON.parse(JSON.stringify(DEFAULT_GRID));
      Object.keys(newGrid).forEach(day => {
        tasks.forEach((_, index) => {
          newGrid[day][`task${index + 1}`] = false;
        });
      });
      await env.GRID_KV.put('grid/current', JSON.stringify(newGrid));
    }
  },
};
