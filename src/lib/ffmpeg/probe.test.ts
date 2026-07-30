// @ts-ignore
import { describe, test, expect } from 'bun:test';
import { probeDuration } from './probe';
import path from 'path';

describe('probeDuration', () => {
  test('should return duration for valid media file', async () => {
    const dummyPath = path.resolve(process.cwd(), 'dummy.mp4');
    const duration = await probeDuration(dummyPath);
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThan(0);
  });

  test('should throw error for non-existent or invalid file', async () => {
    const invalidPath = path.resolve(process.cwd(), 'non_existent_file.mp3');
    expect(probeDuration(invalidPath)).rejects.toThrow('Gagal membaca durasi file audio.');
  });
});
