# Pulsify bot image. Railway builds this directly, so dashboard install/build settings
# (and NODE_ENV=production left over from earlier services) can't change how it's built.
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

# Full install, build tools included, whatever NODE_ENV or npm's production setting says.
# Always from the public registry: package-lock.json written inside Replit points at Replit's private
# mirror, which doesn't exist anywhere else. Fail here, loudly, if the compiler didn't arrive.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund --registry=https://registry.npmjs.org/ --replace-registry-host=always \
 && node -e "require.resolve('typescript')" \
 || (echo 'npm install did not provide TypeScript; see the npm output above' && exit 1)

COPY tsconfig.json ./
COPY src ./src
COPY assets ./assets

# Compile, then drop the build-only packages from the final image.
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

CMD ["node", "dist/index.js"]
