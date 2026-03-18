import { Paths, File, Directory } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DOWNLOADS_DIR_NAME = 'downloads';
const DOWNLOADS_KEY = '@sinemani_downloads';

export interface DownloadedEpisode {
    episodeId: number;
    dramaId: number;
    dramaTitle: string;
    episodeNumber: number;
    seasonNumber: number;
    title: string;
    thumbnail: string | null;
    localUri: string;
    fileSize: number;
    downloadedAt: number;
}

function getDownloadsDir(): Directory {
    return new Directory(Paths.document, DOWNLOADS_DIR_NAME);
}

function ensureDir() {
    if (Platform.OS === 'web') return;
    const dir = getDownloadsDir();
    if (!dir.exists) {
        dir.create();
    }
}

/** Get all downloaded episodes from storage */
export async function getDownloads(): Promise<DownloadedEpisode[]> {
    try {
        const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/** Save downloads list */
async function saveDownloads(downloads: DownloadedEpisode[]) {
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
}

/** Check if an episode is downloaded */
export async function isDownloaded(episodeId: number): Promise<boolean> {
    const list = await getDownloads();
    return list.some(d => d.episodeId === episodeId);
}

/** Get local URI for a downloaded episode */
export async function getLocalUri(episodeId: number): Promise<string | null> {
    const list = await getDownloads();
    const item = list.find(d => d.episodeId === episodeId);
    if (!item) return null;
    if (Platform.OS === 'web') return null;
    const file = new File(item.localUri);
    if (!file.exists) {
        // File was deleted externally, clean up record
        await removeDownload(episodeId);
        return null;
    }
    return item.localUri;
}

/** Download an episode video */
export async function downloadEpisode(
    videoUrl: string,
    meta: {
        episodeId: number;
        dramaId: number;
        dramaTitle: string;
        episodeNumber: number;
        seasonNumber: number;
        title: string;
        thumbnail: string | null;
    },
): Promise<DownloadedEpisode> {
    if (Platform.OS === 'web') {
        throw new Error('Downloads are not available on web');
    }

    ensureDir();

    const ext = videoUrl.split('.').pop()?.split('?')[0] || 'mp4';
    const fileName = `ep_${meta.episodeId}.${ext}`;
    const destFile = new File(getDownloadsDir(), fileName);

    // Remove old file if exists
    if (destFile.exists) {
        destFile.delete();
    }

    const downloaded = await File.downloadFileAsync(videoUrl, destFile);

    const record: DownloadedEpisode = {
        episodeId: meta.episodeId,
        dramaId: meta.dramaId,
        dramaTitle: meta.dramaTitle,
        episodeNumber: meta.episodeNumber,
        seasonNumber: meta.seasonNumber,
        title: meta.title,
        thumbnail: meta.thumbnail,
        localUri: downloaded.uri,
        fileSize: downloaded.size ?? 0,
        downloadedAt: Date.now(),
    };

    const list = await getDownloads();
    const filtered = list.filter(d => d.episodeId !== meta.episodeId);
    filtered.push(record);
    await saveDownloads(filtered);

    return record;
}

/** Remove a downloaded episode */
export async function removeDownload(episodeId: number): Promise<void> {
    const list = await getDownloads();
    const item = list.find(d => d.episodeId === episodeId);
    if (item && Platform.OS !== 'web') {
        try {
            const file = new File(item.localUri);
            if (file.exists) file.delete();
        } catch {}
    }
    await saveDownloads(list.filter(d => d.episodeId !== episodeId));
}

/** Get total download size in bytes */
export async function getTotalDownloadSize(): Promise<number> {
    const list = await getDownloads();
    return list.reduce((sum, d) => sum + d.fileSize, 0);
}

/** Format bytes to human readable */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
