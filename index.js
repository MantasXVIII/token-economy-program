import jwt from 'jsonwebtoken';
import { UI_HTML } from './.wrangler/tmp/ui_html.js';

const DEFAULT_GRID = {
  Monday: { task1: false, task2: false, task3: false, task4: false, task5: false, task6: false, task7: false, task8: false },
  Tuesday: { task1: false, task2: false, task3: false, task4: false, task5: false, task6: false, task7: false, task8: false },
  Wednesday: { task1: false, task2: false, task3: false, task4: false, task5: false, task6: false, task7: false, task8: false },
  Thursday: { task1: false, task2: false, task3: false, task4: false, task5: false, task6: false, task7: false, task8: false },
  Friday: { task1: false, task2: false, task3: false, task4: false, task5: false, task6: false, task7: false, task8: false },
  Saturday: { task1: false, task2: false, task3: false, task4: false, task5: false, task6: false, task7: false, task8: false },
  Sunday: { task1: false, task2: false, task3: false, task4: false, task5: false, task6: false, task7: false, task8: false },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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

    if (url.pathname === '/login' && request.method === 'POST') {
      const { username, password } = await request.json();
      let role = null;
      if (username === 'editor' && password === env.EDITOR_PASSWORD) {
        role = 'editor';
      } else if (username === 'viewer' && password === env.VIEWER_PASSWORD) {
        role = 'viewer';
      } else {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const token = jwt.sign({ role }, env.JWT_SECRET, { expiresIn: '1d' });
      return new Response(JSON.stringify({ token, role }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/grid') {
      const user = await authenticate();
      if (user instanceof Response) return user;

      if (request.method === 'GET') {
        let grid = await env.GRID_KV.get('grid/current', { type: 'json' });
        if (!grid) {
          grid = DEFAULT_GRID;
          await env.GRID_KV.put('grid/current', JSON.stringify(grid));
        }
        return new Response(JSON.stringify(grid), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'PUT' && user.role === 'editor') {
        const { day, task, value } = await request.json();
        let grid = await env.GRID_KV.get('grid/current', { type: 'json' }) || DEFAULT_GRID;
        if (grid[day] && grid[day][task] !== undefined) {
          grid[day][task] = value;
          await env.GRID_KV.put('grid/current', JSON.stringify(grid));
        }
        return new Response(JSON.stringify(grid), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Method not allowed or insufficient permissions', { status: 403 });
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
            return new Response('History not found', { status: 404 });
          }
          return new Response(JSON.stringify(grid), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (request.method === 'PUT' && user.role === 'editor') {
          const { day, task, value } = await request.json();
          let grid = await env.GRID_KV.get(`history/${week}`, { type: 'json' });
          if (!grid) {
            return new Response('History not found', { status: 404 });
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

      return new Response('Method not allowed', { status: 405 });
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    if (event.cron === '0 0 * * 0') {
      const currentGrid = await env.GRID_KV.get('grid/current', { type: 'json' }) || DEFAULT_GRID;
      const date = new Date();
      date.setDate(date.getDate() - date.getDay());
      const weekKey = `history/${date.toISOString().split('T')[0]}`;
      await env.GRID_KV.put(weekKey, JSON.stringify(currentGrid));
      await env.GRID_KV.put('grid/current', JSON.stringify(DEFAULT_GRID));
    }
  },
};
