const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const GOOGLE_WORKSPACE_SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/calendar.events',
].join(' ');

type OAuthClient = { clientId: string; clientSecret: string; redirectUri: string };

const parseGoogleResponse = async (response: Response) => {
    const data = await response.json().catch(() => ({})) as any;
    if (!response.ok) throw new Error(data.error_description || data.error?.message || 'Falha na comunicação com o Google Drive.');
    return data;
};

export const createGoogleDriveAuthorizationUrl = (client: OAuthClient, state: string) => {
    const query = new URLSearchParams({
        client_id: client.clientId,
        redirect_uri: client.redirectUri,
        response_type: 'code',
        scope: GOOGLE_WORKSPACE_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
    });
    return `${GOOGLE_AUTH_URL}?${query.toString()}`;
};

export const exchangeGoogleDriveCode = async (client: OAuthClient, code: string) => {
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: client.clientId,
            client_secret: client.clientSecret,
            redirect_uri: client.redirectUri,
            grant_type: 'authorization_code',
            code,
        }),
    });
    return parseGoogleResponse(response);
};

export const refreshGoogleDriveAccessToken = async (client: OAuthClient, refreshToken: string) => {
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: client.clientId,
            client_secret: client.clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    const data = await parseGoogleResponse(response);
    return String(data.access_token || '');
};

const createDriveItem = async (accessToken: string, metadata: Record<string, any>, content?: string) => {
    if (content === undefined) {
        const response = await fetch(DRIVE_API_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(metadata),
        });
        return parseGoogleResponse(response);
    }
    const boundary = `feitosa_${randomBytes(12).toString('hex')}`;
    const body = [
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n`,
        `--${boundary}--`,
    ].join('');
    const response = await fetch(DRIVE_UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
    });
    return parseGoogleResponse(response);
};

export const uploadBackupToGoogleDrive = async (
    accessToken: string,
    content: string,
    filename: string,
    folderId?: string
) => {
    let targetFolderId = folderId;
    if (!targetFolderId) {
        const folder = await createDriveItem(accessToken, {
            name: 'Backups Feitosa Soluções',
            mimeType: 'application/vnd.google-apps.folder',
        });
        targetFolderId = String(folder.id || '');
    }
    const file = await createDriveItem(accessToken, {
        name: filename,
        mimeType: 'application/json',
        parents: targetFolderId ? [targetFolderId] : undefined,
    }, content);
    return { fileId: String(file.id || ''), folderId: targetFolderId };
};
import { randomBytes } from 'node:crypto';
