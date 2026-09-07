import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSeed } from '../lib/seed.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public');
const output = path.join(root, 'dist');

const roles = { platform_admin: '운영사 관리자', chair: '위원장', vice_chair: '부위원장', secretary: '운영·간사', division_lead: '분과장', member: '일반위원', reviewer: '외부 검토자' };
const seed = createSeed();
const demoTenantId = 'tenant-2030';
const withoutCredentials = ({ passwordHash, passwordSalt, ...account }) => account;
const tenant = seed.tenants.find((item) => item.id === demoTenantId);
const chair = seed.users.find((item) => item.id === 'chair-1');
const archiveFolders = [['meeting', '회의 기록'], ['proposal', '정책제안'], ['general', '운영 메모'], ['handover', '인수인계']].map(([key, name]) => ({ id: `archive-folder-${demoTenantId}-${key}`, tenantId: demoTenantId, name, kind: 'system', createdAt: tenant.createdAt, createdBy: null }));
const folderFor = (item) => item.category === '인수인계' ? 'handover' : 'general';
const archiveItems = seed.archiveItems.filter((item) => item.tenantId === demoTenantId).map((item) => ({ ...item, folderId: `archive-folder-${demoTenantId}-${folderFor(item)}`, kind: 'memo', notes: [], history: [], updatedAt: item.createdAt }));
const recordFiles = [
  ...seed.meetings.filter((item) => item.tenantId === demoTenantId).map((item) => ({ id: `record-${item.id}`, tenantId: demoTenantId, source: { type: 'meeting', id: item.id }, title: item.title, category: '회의 기록', categoryId: item.archiveCategoryId, status: item.status || 'scheduled', createdBy: item.createdBy, createdAt: item.createdAt, updatedAt: item.createdAt, currentVersion: 1, versions: [{ version: 1, body: item.minutes || '회의록을 확인하세요.', createdAt: item.createdAt, createdBy: item.createdBy, reason: '기록 파일 생성' }] })),
  ...seed.proposals.filter((item) => item.tenantId === demoTenantId).map((item) => ({ id: `record-${item.id}`, tenantId: demoTenantId, source: { type: 'proposal', id: item.id }, title: item.title, category: '정책 제안', categoryId: item.archiveCategoryId, status: item.status, createdBy: item.ownerId, createdAt: item.createdAt, updatedAt: item.updatedAt, currentVersion: 1, versions: [{ version: 1, body: item.sections?.proposal || '정책제안 내용을 확인하세요.', createdAt: item.updatedAt, createdBy: item.ownerId, reason: '기록 파일 생성' }] })),
];
const dashboardDemo = {
  me: { ...withoutCredentials(chair), tenantPermissions: tenant.settings.rolePermissions },
  roles,
  tenants: [tenant],
  users: seed.users.filter((item) => item.tenantId === demoTenantId).map(withoutCredentials),
  meetings: seed.meetings.filter((item) => item.tenantId === demoTenantId),
  proposals: seed.proposals.filter((item) => item.tenantId === demoTenantId),
  notifications: seed.notifications.filter((item) => item.userId === chair.id),
  issues: seed.issues.filter((item) => item.tenantId === demoTenantId),
  announcements: seed.announcements.filter((item) => item.tenantId === demoTenantId),
  archiveFolders, archiveItems, recordFiles,
  documentPackages: [], invitations: [], handoverPlans: [], activityReports: [], imports: [],
  aiReportReviewConfigured: false, aiProposalAssistConfigured: false,
  communityPosts: seed.communityPosts.filter((item) => item.tenantId === demoTenantId), deletionRequests: [], auditLogs: [], platform: null,
};

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
const publicConfig = { publicDemo: true, dashboardDemo };
await writeFile(path.join(output, 'runtime-config.js'), `window.WORKROOM_CONFIG = ${JSON.stringify(publicConfig)};\n`, 'utf8');
await writeFile(path.join(output, 'runtime-config.json'), JSON.stringify(publicConfig), 'utf8');
await writeFile(path.join(output, 'vercel.json'), JSON.stringify({
  rewrites: [
    { source: '/explore', destination: '/index.html' },
    { source: '/insights', destination: '/index.html' },
    { source: '/how-it-works', destination: '/index.html' },
    { source: '/use-cases', destination: '/index.html' },
    { source: '/governance-and-security', destination: '/index.html' },
    { source: '/about', destination: '/index.html' },
    { source: '/pilot', destination: '/index.html' },
  ],
  headers: [{ source: '/:path*', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ] }],
}, null, 2), 'utf8');
console.log('Public demo built in dist/.');
