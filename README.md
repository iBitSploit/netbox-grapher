# NetBox Grapher

A browser-based infrastructure, topology, rack, and IPAM view for NetBox.

## Live Demo

It currently is in a kind of a state where you do logins with...a token, I'm working on fixing that, also the fact that the whole project is just a single file

**You can try it live on netlify https://netbox-grapher.netlify.app/**

## Development

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env` to configure defaults for a deployment. `VITE_*` values are compiled into the browser bundle, so never put a production secret in `VITE_NETBOX_TOKEN`. Users can enter their token in the connection screen instead.

Important settings include `VITE_NETBOX_URL`, `VITE_DEFAULT_VIEW`, `VITE_REFRESH_INTERVAL_MS`, `VITE_ENABLE_IP_GRAPH`, `VITE_ENABLE_CIRCUITS`, and `VITE_STORAGE_KEY`.

The app connects directly from the browser to NetBox. The NetBox API must allow the app origin through CORS, and the token needs read access to DCIM, IPAM, and Circuits.

## Validation

```bash
npm run lint
npm run build
```

## Production container

The image uses a Node build stage and an Nginx runtime stage:

```bash
docker compose up --build -d
```

Set `COMPOSE_PORT` in `.env` to change the host port, then open `http://localhost:${COMPOSE_PORT}`. The container exposes `/healthz` and includes an HTTP health check.

## Structure

- `src/App.jsx`: application state, data loading, selection, and view composition.
- `src/lib/netboxApi.js`: cached NetBox requests and pagination.
- `src/features/connection`: NetBox connection form.
- `src/features/navigation`: site and rack navigation.
- `src/features/racks`: rack elevation view.
- `src/features/graphs`: topology and IPAM graph views.
- `src/features/details`: device and circuit detail panels.
- `src/app`: shared theme, UI primitives, and global styles.
