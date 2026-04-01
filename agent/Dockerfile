FROM nginx:stable-alpine AS runner

WORKDIR /usr/share/nginx/html

ARG VERSION
ARG OSQUERY_BINARY_REQUIRED=false

# Always copy builds
COPY dist/${VERSION}/builds/ ./${VERSION}/builds/

# Copy osqueryi binaries (always copy if directory exists)
COPY dist/${VERSION}/builds-osqueryi/ ./${VERSION}/builds-osqueryi/

# Conditionally remove osqueryi binaries if not required (for lighter container)
RUN if [ "$OSQUERY_BINARY_REQUIRED" != "true" ]; then \
        echo "⏭️  OSQUERY_BINARY_REQUIRED=false - removing osqueryi binaries (lighter container)"; \
        rm -rf ./${VERSION}/builds-osqueryi/*; \
        echo "✅ Removed osqueryi binaries"; \
    else \
        echo "📦 OSQUERY_BINARY_REQUIRED=true - keeping osqueryi binaries"; \
        if [ -z "$(ls -A ./${VERSION}/builds-osqueryi 2>/dev/null)" ]; then \
            echo "❌ Error: OSQUERY_BINARY_REQUIRED=true but builds-osqueryi is empty"; \
            exit 1; \
        fi; \
        echo "✅ Osqueryi binaries verified"; \
    fi

COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
