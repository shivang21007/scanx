import { getCurrentISTString } from '../utils/timezone';
import express from 'express';

const router: express.Router = express.Router();

// Read versions from environment variables (passed from docker-compose)
// These are set by docker-compose-helper.sh which reads from agent.conf
function getVersions() {
    const scanxVersion = process.env.SCANX_VERSION || '1.0.0';
    const osqueryiVersion = process.env.OSQUERYI_VERSION || '5.19.0';
    
    console.log(`📦 Using versions - Scanx: ${scanxVersion}, Osqueryi: ${osqueryiVersion}`);
    
    return {
        scanxVersion,
        osqueryiVersion,
    };
}

// Check if osqueryi binaries are included in agent container
function isOsqueryiBinaryRequired(): boolean {
    // Read from environment variable (set in docker-compose.yml)
    const required = process.env.OSQUERY_BINARY_REQUIRED || 'false';
    return required.toLowerCase() === 'true';
}

router.get('/update-check', (req: express.Request, res: express.Response) => {
    // Get the original host and port from the request
    // When behind nginx proxy, we need to check X-Forwarded headers
    const forwardedHost = req.headers['x-forwarded-host'] as string;
    const forwardedProto = req.headers['x-forwarded-proto'] as string;
    const host = req.headers.host;
    
    // Construct base URL - prefer X-Forwarded headers if present (from nginx)
    let baseUrl: string;
    if (forwardedHost) {
        const protocol = forwardedProto || 'http';
        baseUrl = `${protocol}://${forwardedHost}`;
    } else if (host) {
        // Direct access or host header includes port
        const protocol = req.protocol || 'http';
        baseUrl = `${protocol}://${host}`;
    } else {
        // Fallback - shouldn't happen
        baseUrl = 'http://localhost:5173';
    }
    
    // Get versions from environment variables (single source of truth: agent.conf via docker-compose)
    const config = getVersions();
    const scanxLatestVersion = config.scanxVersion;
    const osqueryiLatestVersion = config.osqueryiVersion;
    
    // Determine if osqueryi update is mandatory based on whether binaries are included
    const osqueryiMandatory = isOsqueryiBinaryRequired();
    
    res.json({ 
        description: "This is endpoint for updates check, it will return the latest version of the app and the details of the update.",
        details: {
            scanx: {
                version: scanxLatestVersion,
                // Template URL - agent will substitute {platform}, {arch}, {.exe}
                download_url: `${baseUrl}/api/updates/download/${scanxLatestVersion}/builds/scanx-{platform}-{arch}{.exe}`,
                checksum_url: `${baseUrl}/api/updates/download/${scanxLatestVersion}/builds/checksums.json`,
                mandatory: true,
                release_notes: "This is the release notes for the scanx update",
            },
            osqueryi: {
                version: osqueryiLatestVersion,
                // NOTE: osqueryi is bundled with scanx, so we serve it from the scanx version directory
                // Template URL - agent will substitute {platform}, {arch}, {.exe}
                download_url: `${baseUrl}/api/updates/download/${scanxLatestVersion}/builds-osqueryi/osqueryi-{platform}-{arch}{.exe}`,
                checksum_url: `${baseUrl}/api/updates/download/${scanxLatestVersion}/builds-osqueryi/checksums.json`,
                mandatory: osqueryiMandatory, // Dynamic based on OSQUERY_BINARY_REQUIRED
                release_notes: "This is the release notes for the osqueryi update",
            }
        },
        requested_host: {
            host_ip: req.ip,
            host_user_agent: req.headers['user-agent'],
        },
        timestamp: getCurrentISTString(),
    });
});

export default router;
