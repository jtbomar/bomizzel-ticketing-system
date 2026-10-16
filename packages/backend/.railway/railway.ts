import { defineRailway, github, project, service, volume } from 'railway/iac';
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = 'backend';
export default defineRailway(() => {
  // Uploaded files live here (/data); keep it attached
  const backendVolume = volume('backend-volume', { region: 'us-west2', sizeMB: 5000 });
  const backend = service('backend', {
    source: github('jtbomar/bomizzel-ticketing-system', {
      branch: 'main',
      checkSuites: false,
      rootDirectory: 'packages/backend',
    }),
    build: {
      buildCommand: 'npm run build --workspace=backend',
      buildEnvironment: 'V3',
      builder: 'NIXPACKS',
      watchPatterns: ['/packages/backend/**'],
    },
    start: 'node -r ts-node/register/transpile-only -r tsconfig-paths/register src/index.ts',
    preDeploy: [],
    // Restart policy: Railway's default (on failure, up to 10 restarts), as railway.json had
    replicas: { 'us-west2': 1 },
    volumeMounts: { '/data': backendVolume },
  });

  return project('hospitable-patience', {
    variables: { managed: false },
    resources: [backend, backendVolume],
  });
});
