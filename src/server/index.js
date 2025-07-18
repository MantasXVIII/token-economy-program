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
    console.log(`Request for: ${url.pathname}, Method: ${request.method}`); // Debugging log

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
        return new Response(JSON.stringify({ error: 'Tasks not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(tasks), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/login' && request.method === 'POST') {
      console.log('Handling login request'); // Debugging log
      try {
        const { username, password } = await request.json();
        console.log(`Login attempt: ${username}, ${password ? 'password set' : 'no password'}`);
        let role = null;
        if (username === 'editor' && password === env.EDITOR_PASSWORD) {
          role = 'editor';
        } else if (username === 'viewer' && password === env.VIEWER_PASSWORD) {
          role = 'viewer';
        }
        if (role) {
          const token = jwt.sign({ role }, env.JWT_SECRET, { expiresIn: '1d' });
          return new Response(JSON.stringify({ token, role }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        console.error('Login error:', e);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname === '/grid') {
      const user = await authenticate();
      if (user instanceof Response) return user;

      if (request.method === 'GET') {
        let grid = await env.GRID_KV.get('grid/current', { type: 'json' });
        if (!grid) {
          const tasks = await env.GRID_KV.get('tasks.json', { type: 'json' });
          grid = JSON.parse(JSON.stringify(DEFAULT_GRID));
          Object.keys(grid).forEach(day => {
            tasks.forEach((_, index) => {
              grid[day][`task${index + 1}`] = false;
            });
          });
          await env.GRID_KV.put('grid/current', JSON.stringify(grid));
        }
        return new Response(JSON.stringify(grid), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'PUT' && user.role === 'editor') {
        const { day, task, value } = await request.json();
        let grid = await env.GRID_KV.get('grid/current', { type: 'json' }) || JSON.parse(JSON.stringify(DEFAULT_GRID));
        if (grid[day] && grid[day][task] !== undefined) {
          grid[day][task] = value;
          await env.GRID_KV.put('grid/current', JSON.stringify(grid));
        }
        return new Response(JSON.stringify(grid), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Method not allowed or insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname.startsWith('/history')) {
      const user = await authenticate();
      if (user instanceof Response) return user;

      if (url.pathname === '/history' && request.method === 'GET') {
        const keys = await env.GRID_KV.list({ prefix: 'history/' });
        const history = keys.keys.map(key => ({ week: key.name.replace('history/', '') }));
        return new Response(JSON.stringify(history), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname.match(/^\/history\/\d{4}-\d{2}-\d{2}$/)) {
        const week = url.pathname.split('/').pop();
        if (request.method === 'GET') {
          const grid = await env.GRID_KV.get(`history/${week}`, { type: 'json' });
          if (!grid) {
            return new Response(JSON.stringify({ error: 'History not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify(grid), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (request.method === 'PUT' && user.role === 'editor') {
          const { day, task, value } = await request.json();
          let grid = await env.GRID_KV.get(`history/${week}`, { type: 'json' });
          if (!grid) {
            return new Response(JSON.stringify({ error: 'History not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          if (grid[day] && grid[day][task] !== undefined) {
            grid[day][task] = value;
            await env.GRID_KV.put(`history/${week}`, JSON.stringify(grid));
          }
          return new Response(JSON.stringify(grid), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
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
