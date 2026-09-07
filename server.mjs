import crypto from 'node:crypto';
import { lookup } from 'node:dns/promises';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createSeed, verifyPassword } from './lib/seed.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const ROLES = {
  platform_admin: '운영사 관리자', chair: '위원장', vice_chair: '부위원장', secretary: '운영·간사', division_lead: '분과장', member: '일반위원', reviewer: '외부 검토자',
};
const TENANT_ROLES = ['secretary', 'chair', 'vice_chair', 'division_lead', 'member', 'reviewer'];
const MUTATORS = new Set(Object.keys(ROLES));
const SEED_DEFAULTS = createSeed();
const DEFAULT_POSITION_LABELS = { chair: '위원장', vice_chair: '부위원장', secretary: '간사', division_lead: '분과장', member: '일반위원' };
const DEFAULT_ROLE_PERMISSIONS = {
  chair: { manage: true, permissions: true, personalData: true, share: true },
  vice_chair: { manage: true, permissions: false, personalData: false, share: true },
  secretary: { manage: true, permissions: false, personalData: true, share: true },
  division_lead: { manage: false, permissions: false, personalData: false, share: true },
  member: { manage: false, permissions: false, personalData: false, share: false },
  reviewer: { manage: false, permissions: false, personalData: false, share: false },
};
const INSTITUTION_TYPES = new Set(['중앙정부', '광역 지자체', '기초 지자체']);
const ORGANIZATION_PROFILE_FIELDS = ['displayName', 'shortName', 'institutionName', 'institutionType', 'institutionHomepageUrl', 'youthPolicyUrl', 'participationGuideUrl', 'pressReleaseFeedUrl', 'pressReleaseSourceName', 'representativeName', 'representativeRole', 'contactEmail', 'contactPhone', 'ordinanceName', 'ordinanceArticle', 'ordinanceUrl', 'termLabel', 'termStartsAt', 'termEndsAt', 'activityPeriod', 'introduction', 'logoUrl', 'logoText'];
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6';
const SERVICE_ACCESS_PLANS = new Set(['template_experience', 'institutional_contract', 'sponsored_seat']);
const SERVICE_ACCESS_STATUSES = new Set(['demo', 'proposal_pending', 'active', 'paused', 'expired']);
const SPONSOR_TYPES = new Set(['', '지자체', '재단', '기업', '연구소', '기타']);
const SUPPORT_LEVELS = new Set(['none', 'standard', 'dedicated']);
const INSTITUTION_INBOX_ROLES = new Set(['chair', 'secretary']);
const IMPORTABLE_EXTENSIONS = new Set(['.hwp', '.hwpx', '.pdf', '.xlsx', '.csv', '.txt']);
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_MEETING_PHOTO_BYTES = 5 * 1024 * 1024;
const IMPORT_REVIEW_DAYS = 30;
const PRESS_RELEASE_POLL_MS = 3 * 60 * 60 * 1000;
const PRESS_RELEASE_MAX_BYTES = 1024 * 1024;
const DOCUMENT_PACKAGE_TYPES = new Set(['meeting_summary', 'policy_delivery', 'activity_collection']);
const ARCHIVE_FOLDER_TEMPLATES = [
  ['meeting', '회의·운영 기록'], ['proposal', '정책제안'], ['notice', '공지·이슈'], ['handover', '기수 인계'], ['memo', '운영 메모'], ['general', '기타 자료'],
];
const ARCHIVE_CATEGORY_TONES = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'];
const DEFAULT_ARCHIVE_CATEGORIES = [
  ['red', '중요 결정'], ['orange', '회의 기록'], ['yellow', '정책 제안'], ['green', '운영 자료'], ['blue', '동향 자료'], ['indigo', '학습 자료'], ['violet', '인수인계'],
].map(([color, name]) => ({ id: `archive-category-${color}`, name, color }));

const id = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const now = () => new Date().toISOString();
const safeUser = ({ passwordHash, passwordSalt, avatar, ...user }) => ({ ...user, avatarUrl: avatar?.storedName ? `/api/avatars/${encodeURIComponent(user.id)}` : '' });
const imageType = (buffer) => {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { extension: '.png', contentType: 'image/png' };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: '.jpg', contentType: 'image/jpeg' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { extension: '.webp', contentType: 'image/webp' };
  return null;
};
const text = (value, max = 240) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const normalKey = (value) => text(value, 120).toLowerCase().replace(/[\s_\-·()（）\[\]{}]/g, '');
const xmlText = (value) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi, (_match, hex, decimal) => String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10))).replace(/\s+/g, ' ').trim();
const decodeUtf16be = (buffer) => {
  const copy = Buffer.from(buffer);
  for (let index = 0; index + 1 < copy.length; index += 2) { const current = copy[index]; copy[index] = copy[index + 1]; copy[index + 1] = current; }
  return copy.toString('utf16le');
};
const columnIndex = (reference = '') => [...(String(reference).match(/^[A-Z]+/i)?.[0] || 'A')].reduce((value, letter) => (value * 26) + letter.toUpperCase().charCodeAt(0) - 64, 0) - 1;
const csvRows = (source) => {
  const rows = []; let row = []; let value = ''; let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]; const next = source[index + 1];
    if (character === '"' && quoted && next === '"') { value += '"'; index += 1; } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(text(value, 500)); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && next === '\n') index += 1; row.push(text(value, 500)); if (row.some(Boolean)) rows.push(row); row = []; value = ''; }
    else value += character;
  }
  row.push(text(value, 500)); if (row.some(Boolean)) rows.push(row);
  return rows.slice(0, 500);
};
const zipEntries = (buffer) => {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > buffer.length) throw new Error('압축 문서의 목록을 읽지 못했습니다.');
  const count = buffer.readUInt16LE(eocd + 10); let cursor = buffer.readUInt32LE(eocd + 16); const entries = new Map(); let expanded = 0;
  if (count > 300) throw new Error('문서 안의 파일 수가 너무 많습니다.');
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('압축 문서 구조를 확인하지 못했습니다.');
    const flags = buffer.readUInt16LE(cursor + 8); const method = buffer.readUInt16LE(cursor + 10); const compressedSize = buffer.readUInt32LE(cursor + 20); const size = buffer.readUInt32LE(cursor + 24); const nameLength = buffer.readUInt16LE(cursor + 28); const extraLength = buffer.readUInt16LE(cursor + 30); const commentLength = buffer.readUInt16LE(cursor + 32); const localOffset = buffer.readUInt32LE(cursor + 42); const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if ((flags & 1) || size > 6 * 1024 * 1024 || (compressedSize && size / compressedSize > 120)) throw new Error('암호화되었거나 검토 한도를 넘는 압축 문서입니다.');
    expanded += size; if (expanded > 12 * 1024 * 1024 || localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('압축 문서 크기 또는 구조를 확인하지 못했습니다.');
    const localNameLength = buffer.readUInt16LE(localOffset + 26); const localExtraLength = buffer.readUInt16LE(localOffset + 28); const payload = buffer.subarray(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize);
    entries.set(name, method === 0 ? payload : method === 8 ? zlib.inflateRawSync(payload) : (() => { throw new Error('지원하지 않는 압축 방식입니다.'); })());
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};
const xmlEscape = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const crc32 = (buffer) => { let value = 0xffffffff; for (const byte of buffer) { value ^= byte; for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); } return (value ^ 0xffffffff) >>> 0; };
const storedZip = (entries) => {
  const locals = []; const central = []; let offset = 0;
  for (const [name, value] of entries) { const fileName = Buffer.from(name); const payload = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8'); const checksum = crc32(payload); const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(payload.length, 22); local.writeUInt16LE(fileName.length, 26); locals.push(local, fileName, payload); const header = Buffer.alloc(46); header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt32LE(checksum, 16); header.writeUInt32LE(payload.length, 20); header.writeUInt32LE(payload.length, 24); header.writeUInt16LE(fileName.length, 28); header.writeUInt32LE(offset, 42); central.push(header, fileName); offset += local.length + fileName.length + payload.length; }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16); return Buffer.concat([...locals, ...central, end]);
};
const documentTypeLabel = (type) => ({ meeting_summary: '회의 결과 정리', policy_delivery: '정책제안 전달문', activity_collection: '기수 활동자료집' })[type] || '통합 자료';
const documentPackageText = (item) => [item.title, item.recipient ? `수신: ${item.recipient}` : '', item.summary ? `요약\n${item.summary}` : '', ...(item.sources || []).flatMap((source, index) => [`${index + 1}. ${source.title}`, source.category ? `[${source.category}]` : '', source.body || ''])].filter((line) => line !== '').join('\n\n');
const docxFromPackage = (item) => {
  const paragraphs = documentPackageText(item).split(/\r?\n/).map((line) => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line || ' ')}</w:t></w:r></w:p>`).join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  return storedZip([['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'], ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'], ['word/document.xml', document]]);
};
const printableDocumentHtml = (item) => `<!doctype html><html lang="ko"><meta charset="utf-8"><title>${xmlEscape(item.title)}</title><style>body{max-width:760px;margin:48px auto;color:#17212c;font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif;line-height:1.7}h1{font-size:26px;border-bottom:1px solid #cfd7d3;padding-bottom:16px}.meta{color:#5e6b67}.summary{padding:16px;background:#f2f7f5;white-space:pre-wrap}.source{padding:18px 0;border-bottom:1px solid #dfe6e2}.source h2{font-size:18px;margin:0 0 8px}.source p{white-space:pre-wrap}@media print{body{margin:0;max-width:none}.print-note{display:none}}</style><body><p class="print-note">브라우저 인쇄 기능에서 ‘PDF로 저장’을 선택해 전달용 PDF를 만드세요.</p><h1>${xmlEscape(item.title)}</h1><p class="meta">${xmlEscape(documentTypeLabel(item.type))}${item.recipient ? ` · 수신: ${xmlEscape(item.recipient)}` : ''} · 생성 ${xmlEscape(item.createdAt || '')}</p>${item.summary ? `<section class="summary">${xmlEscape(item.summary)}</section>` : ''}${(item.sources || []).map((source, index) => `<section class="source"><h2>${index + 1}. ${xmlEscape(source.title)}</h2><p class="meta">${xmlEscape(source.category || '')}</p><p>${xmlEscape(source.body || '')}</p></section>`).join('')}</body></html>`;
const xlsxRows = (buffer) => {
  const entries = zipEntries(buffer); const shared = entries.get('xl/sharedStrings.xml'); const strings = shared ? [...shared.toString('utf8').matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) => xmlText(match[1])) : [];
  const sheets = [...entries.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort(); if (!sheets.length) throw new Error('엑셀 시트를 찾지 못했습니다.');
  let best = [];
  for (const sheet of sheets.slice(0, 8)) {
    const rows = []; const source = entries.get(sheet).toString('utf8');
    for (const rowMatch of source.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = []; for (const cell of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) { const attrs = cell[1]; const body = cell[2]; const reference = /\br="([A-Z]+\d+)"/i.exec(attrs)?.[1] || 'A1'; const type = /\bt="([^"\s]+)"/i.exec(attrs)?.[1]; const raw = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1] || /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] || ''; row[columnIndex(reference)] = text(type === 's' ? strings[Number(raw)] : xmlText(raw), 500); }
      if (row.some(Boolean)) rows.push(row);
    }
    if (rows.length > best.length) best = rows;
  }
  return best.slice(0, 500);
};
const hwpxText = (buffer) => {
  const entries = zipEntries(buffer); const sections = [...entries.entries()].filter(([name]) => /^Contents\/section\d+\.xml$/i.test(name)); if (!sections.length) throw new Error('HWPX 본문을 찾지 못했습니다.');
  return text(sections.map(([, value]) => xmlText(value.toString('utf8'))).join('\n'), 40000);
};
const pdfText = (buffer) => {
  const source = buffer.toString('latin1'); const parts = [];
  for (const match of source.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) parts.push(match[0].slice(1, match[0].lastIndexOf(')')).replace(/\\([()\\])/g, '$1'));
  for (const match of source.matchAll(/<([0-9a-fA-F]{4,})>\s*Tj/g)) { const raw = Buffer.from(match[1], 'hex'); parts.push(raw.subarray(0, 2).equals(Buffer.from([0xfe, 0xff])) ? decodeUtf16be(raw.subarray(2)) : raw.toString('utf8')); }
  return text(parts.join('\n'), 40000);
};
const valueFor = (pairs, aliases) => pairs.find(([label]) => aliases.some((alias) => normalKey(label).includes(normalKey(alias))))?.[1] || '';
const roleFrom = (value) => ({ '위원장': 'chair', '부위원장': 'vice_chair', '간사': 'secretary', '운영간사': 'secretary', '분과장': 'division_lead', '외부검토자': 'reviewer', '검토자': 'reviewer' })[normalKey(value)] || 'member';
const importCandidates = (rows, sourceText = '') => {
  const profileAliases = { displayName: ['기구명', '위원회명', '참여기구명', '명칭'], shortName: ['약칭'], institutionName: ['소속기관', '주관기관', '운영기관', '담당기관'], institutionType: ['기관구분', '기관유형', '행정기관구분'], representativeName: ['위원장', '대표자', '대표'], representativeRole: ['대표직책', '대표역할'], contactPhone: ['대표연락처', '연락처', '전화번호'], contactEmail: ['대표이메일', '이메일'], ordinanceName: ['근거조례', '근거규정', '조례명'], ordinanceArticle: ['관련조문', '조문'], termLabel: ['기수', '임기명칭'], termStartsAt: ['임기시작'], termEndsAt: ['임기종료'], activityPeriod: ['활동기간'], introduction: ['기구소개', '소개'] };
  const headerIndex = rows.findIndex((row) => row.some((cell) => ['이름', '성명', '위원명', 'email', '이메일'].includes(normalKey(cell))));
  const pairs = rows.filter((row, index) => index !== headerIndex && (headerIndex < 0 || index < headerIndex) && row.length >= 2 && row[0] && row[1]).map((row) => [row[0], row[1]]);
  for (const line of String(sourceText).split(/\n+/)) { const match = /^\s*([^:：]{2,40})\s*[:：]\s*(.{1,400})$/.exec(line); if (match) pairs.push([match[1], match[2]]); }
  const profile = Object.fromEntries(Object.entries(profileAliases).map(([key, aliases]) => [key, text(valueFor(pairs, aliases), key === 'introduction' ? 1000 : 240)]));
  const members = [];
  if (headerIndex >= 0) {
    const headers = rows[headerIndex].map(normalKey); const at = (...aliases) => headers.findIndex((header) => aliases.some((alias) => header === normalKey(alias) || header.includes(normalKey(alias))));
    const nameAt = at('이름', '성명', '위원명', 'name'); const emailAt = at('이메일', 'email'); const roleAt = at('역할', '직책', '구분', 'role'); const termAt = at('임기', '기수', 'term'); const ageAt = at('연령대', '연령', 'age'); const jobAt = at('직업', '소속', 'job'); const regionAt = at('시군구', '지역', '거주지', 'region');
    for (const row of rows.slice(headerIndex + 1, headerIndex + 301)) { const name = text(row[nameAt], 80); if (!name) continue; members.push({ id: id('import-member'), sourceRow: headerIndex + members.length + 2, name, email: text(row[emailAt], 160), role: roleFrom(row[roleAt]), term: text(row[termAt], 80), ageBand: text(row[ageAt], 40) || '응답하지 않음', job: text(row[jobAt], 120), region: text(row[regionAt], 120), included: true }); }
  }
  return { profile, members };
};
const ensureOrgChart = (tenant) => {
  tenant.settings ||= {};
  if (!Array.isArray(tenant.settings.orgChart?.nodes)) {
    const rootId = `org-root-${tenant.id}`;
    tenant.settings.orgChart = { nodes: [{ id: rootId, name: tenant.name, parentId: null, kind: '기구', createdAt: tenant.createdAt || now() }, ...(tenant.settings.divisions || []).map((name, index) => ({ id: `org-division-${tenant.id}-${index + 1}`, name, parentId: rootId, kind: '분과', createdAt: tenant.createdAt || now() }))], history: [], updatedAt: tenant.createdAt || now() };
  }
  if (!Array.isArray(tenant.settings.orgChart.history)) tenant.settings.orgChart.history = [];
  return tenant.settings.orgChart;
};
const organizationSnapshot = (member) => ({
  role: member.role,
  orgNodeId: member.orgNodeId || null,
  orgAssignments: structuredClone(member.orgAssignments || []),
});
const sameOrganizationSnapshot = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const recordOrganizationChange = (tenant, actor, member, before, changeType = 'assignment') => {
  const chart = ensureOrgChart(tenant);
  const after = organizationSnapshot(member);
  if (sameOrganizationSnapshot(before, after)) return null;
  const entry = { id: id('org-change'), type: changeType, memberId: member.id, before, after, createdBy: actor.id, createdAt: now() };
  chart.history.unshift(entry);
  chart.history = chart.history.slice(0, 50);
  chart.updatedAt = now();
  return entry;
};
const ensureTenantGovernanceSettings = (tenant) => {
  tenant.settings ||= {};
  tenant.settings.positionLabels = { ...DEFAULT_POSITION_LABELS, ...(tenant.settings.positionLabels || {}) };
  tenant.settings.rolePermissions = Object.fromEntries(Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, defaults]) => [role, { ...defaults, ...(tenant.settings.rolePermissions?.[role] || {}) }]));
  return tenant.settings;
};
const ensureArchiveCategories = (tenant) => {
  tenant.settings ||= {};
  const existing = Array.isArray(tenant.settings.archiveCategories) ? tenant.settings.archiveCategories : [];
  tenant.settings.archiveCategories = DEFAULT_ARCHIVE_CATEGORIES.map((fallback) => {
    const current = existing.find((item) => item?.id === fallback.id) || {};
    return { id: fallback.id, name: text(current.name || fallback.name, 40) || fallback.name, color: ARCHIVE_CATEGORY_TONES.includes(current.color) ? current.color : fallback.color };
  });
  return tenant.settings.archiveCategories;
};
const defaultArchiveCategoryId = (kind = '', legacyCategory = '') => {
  if (/인수인계|기수/.test(legacyCategory) || kind === 'handover') return 'archive-category-violet';
  if (/학습|참고/.test(legacyCategory) || kind === 'learning') return 'archive-category-indigo';
  if (/동향|이슈|공지/.test(legacyCategory) || kind === 'trend') return 'archive-category-blue';
  if (/정책|제안/.test(legacyCategory) || kind === 'proposal') return 'archive-category-yellow';
  if (/회의/.test(legacyCategory) || kind === 'meeting' || kind === 'committee_minutes' || kind === 'division_minutes') return 'archive-category-orange';
  return 'archive-category-green';
};
const normalizeServiceAccess = (tenant) => {
  const current = tenant.serviceAccess || {};
  const plan = SERVICE_ACCESS_PLANS.has(current.plan) ? current.plan : 'template_experience';
  const isSyntheticDemo = current.dataMode === 'synthetic_demo' || tenant.id === 'tenant-2030';
  const sponsorType = plan === 'sponsored_seat' && SPONSOR_TYPES.has(current.sponsorType) ? current.sponsorType : '';
  const sponsorName = plan === 'sponsored_seat' ? String(current.sponsorName || '').trim().slice(0, 120) : '';
  tenant.serviceAccess = {
    plan,
    status: SERVICE_ACCESS_STATUSES.has(current.status) ? current.status : (isSyntheticDemo ? 'demo' : 'proposal_pending'),
    dataMode: plan === 'template_experience' ? (isSyntheticDemo ? 'synthetic_demo' : 'template_only') : 'contracted_workspace',
    sponsorType,
    sponsorName,
    seatLimit: Number.isInteger(current.seatLimit) && current.seatLimit > 0 && current.seatLimit <= 10000 ? current.seatLimit : tenant.capacity,
    startsAt: String(current.startsAt || '').slice(0, 10),
    endsAt: String(current.endsAt || '').slice(0, 10),
    supportLevel: SUPPORT_LEVELS.has(current.supportLevel) ? current.supportLevel : 'none',
    note: String(current.note || '').trim().slice(0, 500),
    contractRequired: plan !== 'template_experience',
  };
  return tenant.serviceAccess;
};
const ensureOrganizationProfile = (tenant) => {
  tenant.settings ||= {};
  const defaultProfile = {
    displayName: tenant.name, shortName: tenant.cohort ? `${tenant.cohort} 참여기구` : '청년참여기구', institutionName: tenant.id === 'tenant-2030' ? '행정안전부' : '소속 기관을 입력해 주세요', institutionType: tenant.id === 'tenant-2030' ? '중앙정부' : '기초 지자체', representativeName: tenant.operator || '운영 담당자', representativeRole: tenant.id === 'tenant-2030' ? '위원장·대표' : '운영 책임자',
    institutionHomepageUrl: '', youthPolicyUrl: '', participationGuideUrl: '', pressReleaseFeedUrl: '', pressReleaseSourceName: '', contactEmail: tenant.id === 'tenant-2030' ? 'chair@workroom.demo' : 'contact@workroom.demo', contactPhone: tenant.id === 'tenant-2030' ? '02-2030-2030' : '02-0000-0000', ordinanceName: '「청년참여 활성화 조례」 (합성 예시)', ordinanceArticle: '제00조', ordinanceUrl: '', termLabel: tenant.cohort || '기수 미정',
    termStartsAt: '', termEndsAt: '', activityPeriod: '활동 기간을 입력해 주세요', introduction: '기구의 목적과 현재 활동 방향을 짧게 소개합니다.', logoUrl: '', logoText: '',
  };
  tenant.settings.organizationProfile = { ...defaultProfile, ...(tenant.settings.organizationProfile || {}) };
  if (!tenant.settings.organizationProfile.logoUrl && tenant.settings.organizationProfile.logoText === String(tenant.cohort || '').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 5)) tenant.settings.organizationProfile.logoText = '';
  return tenant.settings.organizationProfile;
};
const archiveFolderId = (tenantId, key) => `archive-folder-${tenantId}-${key}`;
const ensureArchiveFolders = (data, tenant) => {
  data.archiveFolders ||= [];
  for (const [key, name] of ARCHIVE_FOLDER_TEMPLATES) {
    const folderId = archiveFolderId(tenant.id, key);
    if (!data.archiveFolders.some((folder) => folder.id === folderId)) data.archiveFolders.push({ id: folderId, tenantId: tenant.id, name, kind: 'system', createdAt: tenant.createdAt || now(), createdBy: null });
  }
  for (const item of data.archiveItems || []) {
    if (item.tenantId !== tenant.id) continue;
    if (!item.folderId) item.folderId = archiveFolderId(tenant.id, item.category === '인수인계' ? 'handover' : item.category === '회의 자료' ? 'meeting' : item.category === '정책 참고' ? 'proposal' : 'general');
    if (!Array.isArray(item.notes)) item.notes = [];
    if (!Array.isArray(item.history)) item.history = [{ id: `archive-history-${item.id}`, type: 'legacy_imported', at: item.createdAt || now(), actorId: item.createdBy || null, cohort: tenant.cohort || '기수 미정', detail: '기존 아카이브 자료를 운영 드라이브로 이전했습니다.' }];
    if (!item.updatedAt) item.updatedAt = item.createdAt || now();
    if (!item.kind) item.kind = item.source?.type ? 'record_snapshot' : 'memo';
    if (!tenant.settings.archiveCategories.some((category) => category.id === item.categoryId)) item.categoryId = defaultArchiveCategoryId(item.kind, item.category);
  }
};
const ensureMeetingModel = (meeting, data) => {
  const activeMembers = data.users.filter((user) => user.tenantId === meeting.tenantId && user.active && user.role !== 'platform_admin').map((user) => user.id);
  if (!Array.isArray(meeting.participantIds)) meeting.participantIds = activeMembers;
  if (!meeting.rsvp || typeof meeting.rsvp !== 'object') meeting.rsvp = { ...(meeting.attendance || {}) };
  if (!meeting.attendance || typeof meeting.attendance !== 'object') meeting.attendance = {};
  if (!Array.isArray(meeting.materials)) meeting.materials = [];
  if (!Array.isArray(meeting.agenda)) meeting.agenda = [];
  if (!Array.isArray(meeting.minutesPhotos)) meeting.minutesPhotos = [];
  if (!meeting.status) meeting.status = 'scheduled';
  return meeting;
};
const ensureProposalCommunication = (proposal) => {
  if (!proposal.institutionDelivery || typeof proposal.institutionDelivery !== 'object') proposal.institutionDelivery = { status: 'not_sent', message: '', submittedBy: null, submittedAt: null, receivedBy: null, receivedAt: null, response: null };
  if (!['not_sent', 'sent', 'received', 'responded'].includes(proposal.institutionDelivery.status)) proposal.institutionDelivery.status = 'not_sent';
  if (!proposal.institutionDelivery.response || typeof proposal.institutionDelivery.response !== 'object') proposal.institutionDelivery.response = null;
  return proposal.institutionDelivery;
};
const pushNotification = (data, { userId, tenantId, kind, title, body, proposalId = null }) => {
  if (!userId || !tenantId || !data.users.some((user) => user.id === userId && user.tenantId === tenantId && user.active)) return null;
  const notification = { id: id('notice'), userId, tenantId, kind: String(kind || 'system').slice(0, 40), title: String(title || '새 알림').slice(0, 180), body: String(body || '').slice(0, 1000), proposalId, createdAt: now(), readAt: null };
  data.notifications.unshift(notification);
  data.notifications = data.notifications.slice(0, 1000);
  return notification;
};
const notifyUsers = (data, userIds, payload) => [...new Set(userIds)].forEach((userId) => pushNotification(data, { ...payload, userId }));
const proposalRecipients = (proposal) => [...new Set([proposal.ownerId, ...(proposal.contributors || [])].filter(Boolean))];
const dateWithin = (value, start, end) => {
  if (!value) return false;
  const date = String(value).slice(0, 10);
  return (!start || date >= start) && (!end || date <= end);
};
const buildInvitationCopy = (tenant, invitation, absoluteUrl = '') => {
  const roleLabel = ROLES[invitation.role] || '일반위원';
  const cohort = invitation.term || tenant.cohort;
  const url = absoluteUrl || `/join/${invitation.token}`;
  const extra = String(invitation.messageExtra || '').trim();
  const subject = `[${tenant.name}] ${cohort} ${roleLabel} 참여 초대`;
  const body = `${invitation.email}님,\n\n${tenant.name} ${cohort} ${roleLabel} 참여를 위한 초대 링크를 보냅니다.\n아래 링크에서 이름과 비밀번호를 등록하면, 위원장 승인 후 워크룸에 들어올 수 있습니다.\n\n${url}\n\n링크 사용 기한: ${String(invitation.expiresAt || '').slice(0, 10)}\n${extra ? `\n${extra}\n` : ''}\n전체 생년월일과 민감정보는 받지 않습니다.`;
  return { subject, body, messengerText: `${subject}\n\n${body}` };
};
const buildActivityReport = (data, tenantId, input = {}) => {
  const periodStart = String(input.periodStart || '').slice(0, 10) || null;
  const periodEnd = String(input.periodEnd || '').slice(0, 10) || null;
  const include = (item, key = 'createdAt') => !periodStart && !periodEnd ? true : dateWithin(item[key] || item.createdAt, periodStart, periodEnd);
  const meetings = data.meetings.filter((item) => item.tenantId === tenantId && include(item, 'startsAt'));
  const proposals = data.proposals.filter((item) => item.tenantId === tenantId && include(item, 'updatedAt'));
  const decisions = meetings.flatMap((meeting) => meeting.decisions || []);
  const actualAttendance = meetings.flatMap((meeting) => Object.values(meeting.attendance || {})).filter((status) => ['attending', 'absent'].includes(status));
  const actualAttending = actualAttendance.filter((status) => status === 'attending').length;
  const participantSlots = meetings.reduce((total, meeting) => total + (meeting.participantIds || []).length, 0);
  const rsvp = meetings.flatMap((meeting) => Object.values(meeting.rsvp || {})).filter((status) => ['attending', 'absent'].includes(status));
  const feedback = proposals.flatMap((proposal) => proposal.feedback || []);
  const archiveItems = data.archiveItems.filter((item) => item.tenantId === tenantId && include(item));
  const issues = data.issues.filter((item) => item.tenantId === tenantId && include(item));
  const announcements = data.announcements.filter((item) => item.tenantId === tenantId && include(item));
  const metrics = {
    meetingCount: meetings.length,
    participantSlots,
    actualAttendanceRecorded: actualAttendance.length,
    actualAttendanceRate: actualAttendance.length ? Math.round((actualAttending / actualAttendance.length) * 100) : null,
    rsvpRecorded: rsvp.length,
    decisionCount: decisions.length,
    completedDecisionCount: decisions.filter((item) => item.status === 'completed').length,
    proposalCount: proposals.length,
    submittedProposalCount: proposals.filter((item) => item.status === 'submitted').length,
    feedbackCount: feedback.length,
    resolvedFeedbackCount: feedback.filter((item) => item.status === 'resolved').length,
    archiveCount: archiveItems.length,
    issueCount: issues.length,
    announcementCount: announcements.length,
  };
  const completedRate = metrics.decisionCount ? Math.round((metrics.completedDecisionCount / metrics.decisionCount) * 100) : null;
  const resolvedRate = metrics.feedbackCount ? Math.round((metrics.resolvedFeedbackCount / metrics.feedbackCount) * 100) : null;
  const strengths = [];
  const gaps = [];
  const actions = [];
  if (metrics.meetingCount) strengths.push(`회의 ${metrics.meetingCount}건이 기간 기록에 남아 있습니다.`);
  if (completedRate !== null && completedRate >= 60) strengths.push(`결정·과제 ${metrics.completedDecisionCount}/${metrics.decisionCount}건이 완료로 기록되어 후속 관리가 이어지고 있습니다.`);
  if (metrics.submittedProposalCount) strengths.push(`정책제안 ${metrics.submittedProposalCount}건에 최종 제출 기록이 있습니다.`);
  if (metrics.archiveCount) strengths.push(`다음 기수가 참고할 아카이브 자료 ${metrics.archiveCount}건이 있습니다.`);
  if (metrics.actualAttendanceRate !== null && metrics.actualAttendanceRate >= 70) strengths.push(`실제 출결 기록 기준 참석 비율은 ${metrics.actualAttendanceRate}%입니다.`);
  if (!metrics.meetingCount) gaps.push('선택 기간에 회의 기록이 없습니다. 회의가 없었는지, 기록이 누락됐는지 확인이 필요합니다.');
  if (metrics.participantSlots > metrics.actualAttendanceRecorded) gaps.push(`참석 대상 ${metrics.participantSlots}명 중 실제 출결이 ${metrics.actualAttendanceRecorded}건만 기록되었습니다.`);
  if (metrics.decisionCount && completedRate < 60) gaps.push(`결정·과제 ${metrics.decisionCount - metrics.completedDecisionCount}건이 아직 진행 중입니다.`);
  if (metrics.feedbackCount && resolvedRate < 60) gaps.push(`피드백 ${metrics.feedbackCount - metrics.resolvedFeedbackCount}건이 처리 완료되지 않았습니다.`);
  if (!metrics.archiveCount) gaps.push('기간 내 아카이브 자료가 없습니다. 결정 이유와 미해결 질문을 인수인계 자료로 남길 필요가 있습니다.');
  if (!metrics.submittedProposalCount && metrics.proposalCount) gaps.push('작성 중 제안은 있으나 최종 제출 기록은 없습니다. 다음 검토·제출 조건을 정해 주세요.');
  if (metrics.participantSlots > metrics.actualAttendanceRecorded) actions.push('지난 회의의 실제 출결을 먼저 보완하고, 다음 회의에는 참석 대상과 응답 마감을 함께 설정합니다.');
  if (metrics.decisionCount && completedRate < 100) actions.push('미완료 결정·과제에 담당자와 다음 확인일을 다시 지정합니다.');
  if (metrics.feedbackCount && resolvedRate < 100) actions.push('열린 피드백을 제안서 수정 또는 보류 사유와 연결해 처리 상태를 남깁니다.');
  if (!metrics.archiveCount) actions.push('다음 기수에 필요한 의제 배경·결정 이유·미해결 질문을 인수인계 자료로 등록합니다.');
  return {
    periodStart, periodEnd,
    periodLabel: periodStart || periodEnd ? `${periodStart || '처음'} ~ ${periodEnd || '현재'}` : '전체 누적',
    metrics,
    insights: { strengths: strengths.slice(0, 4), gaps: gaps.slice(0, 4), actions: actions.slice(0, 4) },
    methodology: '개인별 평가나 순위 없이, 선택 기간의 회의·출결·결정·정책제안·피드백·아카이브 기록만 집계합니다.',
  };
};
const recordFileSnapshot = (data, sourceType, item) => {
  if (!item?.tenantId) return null;
  if (sourceType === 'meeting') return { title: item.title, categoryId: item.archiveCategoryId || 'archive-category-orange', category: '회의 기록', status: item.status || 'scheduled', body: `회의 일시: ${item.startsAt || '미정'}\n장소: ${item.location || '미정'}\n\n안건\n${(item.agenda || []).map((agenda) => `- ${agenda.title}`).join('\n') || '등록된 안건이 없습니다.'}\n\n자료\n${(item.materials || []).map((material) => `- ${typeof material === 'string' ? material : material.label || material.url || '자료'}`).join('\n') || '등록된 자료가 없습니다.'}\n\n회의록\n${item.minutes || '회의록 미입력'}\n\n결정·과제\n${(item.decisions || []).map((decision) => `- ${decision.text} · 담당 ${data.users.find((user) => user.id === decision.ownerId)?.name || '미정'} · ${decision.dueAt || '기한 미정'} · ${decision.status === 'completed' ? '완료' : '진행 중'}`).join('\n') || '기록된 결정·과제가 없습니다.'}`, recordedAt: item.updatedAt || item.createdAt || item.startsAt, createdAt: item.createdAt || item.startsAt, createdBy: item.createdBy };
  if (sourceType === 'proposal') { const sections = item.sections || {}; return { title: item.title, categoryId: item.archiveCategoryId || 'archive-category-yellow', category: '정책 제안', status: item.status || 'draft', body: `정책제안 상태: ${item.status || 'draft'}\n\n문제 정의\n${sections.problem || '미입력'}\n\n현장 근거\n${sections.evidence || '미입력'}\n\n제안 내용\n${sections.proposal || '미입력'}\n\n실행 주체·방식\n${sections.implementation || '미입력'}\n\n반론·제약\n${sections.risks || '미입력'}\n\n피드백\n${(item.feedback || []).map((feedback) => `- ${feedback.type || '의견'}: ${feedback.body} (${feedback.status || 'open'})`).join('\n') || '기록된 피드백이 없습니다.'}\n\n기관 전달·회신\n${item.institutionDelivery ? `${item.institutionDelivery.status || '미전달'} · ${item.institutionDelivery.response || '회신 없음'}` : '전달 기록 없음'}`, recordedAt: item.updatedAt || item.createdAt, createdAt: item.createdAt, createdBy: item.createdBy || item.ownerId }; }
  if (sourceType === 'issue') return { title: item.title, categoryId: item.archiveCategoryId || 'archive-category-blue', category: '동향 자료', status: 'recorded', body: `출처: ${item.sourceName || '미입력'}\n확인일: ${item.checkedAt || '미입력'}\n\n운영 메모\n${item.editorNote || '메모 없음'}${item.sourceUrl ? `\n\n원문\n${item.sourceUrl}` : ''}`, recordedAt: item.updatedAt || item.createdAt || item.checkedAt, createdAt: item.createdAt || item.checkedAt, createdBy: item.createdBy };
  if (sourceType === 'announcement') return { title: item.title, categoryId: item.archiveCategoryId || 'archive-category-blue', category: '공지·이슈', status: 'published', body: `대상: ${item.target || '전체'}\n\n${item.body || ''}`, recordedAt: item.updatedAt || item.createdAt, createdAt: item.createdAt, createdBy: item.createdBy };
  if (sourceType === 'handover') return { title: `${item.sourceCohort} → ${item.targetCohort} 기수 인계`, categoryId: 'archive-category-violet', category: '인수인계', status: item.status || 'planned', body: `인계 요약\n${item.summary || '미입력'}\n\n우선 확인 항목\n${item.priorityItems || '미입력'}\n\n선택한 아카이브 자료\n${(item.archiveItemIds || []).length}건`, recordedAt: item.completedAt || item.createdAt, createdAt: item.createdAt, createdBy: item.createdBy };
  if (sourceType === 'report') return { title: item.title, categoryId: 'archive-category-violet', category: '활동 리포트', status: item.status || 'generated', body: `${item.periodLabel || '기간 미정'}\n\n집계 방식\n${item.methodology || ''}\n\n잘 이어진 흐름\n${(item.insights?.strengths || []).map((value) => `- ${value}`).join('\n')}\n\n보완 지점\n${(item.insights?.gaps || []).map((value) => `- ${value}`).join('\n')}\n\n다음 행동\n${(item.insights?.actions || []).map((value) => `- ${value}`).join('\n')}`, recordedAt: item.updatedAt || item.createdAt, createdAt: item.createdAt, createdBy: item.createdBy };
  return null;
};
const recordFileFingerprint = (snapshot) => crypto.createHash('sha256').update(JSON.stringify([snapshot.title, snapshot.categoryId, snapshot.status, snapshot.body])).digest('hex');
const syncRecordFiles = (data) => {
  if (!Array.isArray(data.recordFiles)) data.recordFiles = [];
  const sources = [...(data.meetings || []).map((item) => ['meeting', item]), ...(data.proposals || []).map((item) => ['proposal', item]), ...(data.issues || []).map((item) => ['issue', item]), ...(data.announcements || []).map((item) => ['announcement', item]), ...(data.handoverPlans || []).map((item) => ['handover', item]), ...(data.activityReports || []).map((item) => ['report', item])];
  for (const [sourceType, source] of sources) {
    const snapshot = recordFileSnapshot(data, sourceType, source); if (!snapshot) continue;
    const fingerprint = recordFileFingerprint(snapshot); let file = data.recordFiles.find((item) => item.tenantId === source.tenantId && item.source?.type === sourceType && item.source?.id === source.id);
    if (!file) { data.recordFiles.unshift({ id: id('record-file'), tenantId: source.tenantId, source: { type: sourceType, id: source.id }, title: snapshot.title, category: snapshot.category, categoryId: snapshot.categoryId, status: snapshot.status, createdBy: snapshot.createdBy || null, createdAt: snapshot.createdAt || now(), updatedAt: snapshot.recordedAt || now(), currentVersion: 1, versions: [{ version: 1, body: snapshot.body, fingerprint, createdAt: snapshot.recordedAt || now(), createdBy: snapshot.createdBy || null, reason: '기록 파일 생성' }] }); continue; }
    if (!Array.isArray(file.versions)) file.versions = [];
    const previous = file.versions[0];
    if (!previous || previous.fingerprint !== fingerprint) { const version = (file.currentVersion || file.versions.length || 0) + 1; file.versions.unshift({ version, body: snapshot.body, fingerprint, createdAt: snapshot.recordedAt || now(), createdBy: snapshot.createdBy || null, reason: '원본 기록 변경 반영' }); file.currentVersion = version; }
    file.title = snapshot.title; file.category = snapshot.category; file.categoryId = snapshot.categoryId; file.status = snapshot.status; file.createdBy ||= snapshot.createdBy || null; file.createdAt ||= snapshot.createdAt || now(); file.updatedAt = snapshot.recordedAt || now();
  }
};
const normalizeData = (data) => {
  const platformCollections = ['tenantTemplates', 'contentReviews', 'consultationAssignments', 'casePublicationRequests', 'researchRequests', 'consentVersions', 'retentionPolicies', 'systemNotices', 'oauthStates'];
  for (const key of platformCollections) if (!Array.isArray(data[key])) data[key] = structuredClone(SEED_DEFAULTS[key]);
  if (!Array.isArray(data.archiveFolders)) data.archiveFolders = [];
  if (!Array.isArray(data.archiveItems)) data.archiveItems = [];
  if (!Array.isArray(data.documentPackages)) data.documentPackages = [];
  for (const tenant of data.tenants || []) {
    const template = data.tenantTemplates.find((item) => item.id === tenant.templateId) || data.tenantTemplates[tenant.id === 'tenant-2030' ? 0 : 1] || data.tenantTemplates[0];
    if (!tenant.templateId) tenant.templateId = template?.id || null;
    if (!tenant.settings) tenant.settings = { ageBands: [...(template?.ageBands || [])], divisions: [...(template?.divisions || [])], managerName: tenant.operator || '' };
    ensureTenantGovernanceSettings(tenant); ensureArchiveCategories(tenant); ensureOrganizationProfile(tenant); ensureOrgChart(tenant); ensureArchiveFolders(data, tenant); normalizeServiceAccess(tenant);
    for (const user of data.users.filter((entry) => entry.tenantId === tenant.id)) {
      if (!Array.isArray(user.orgAssignments)) user.orgAssignments = user.orgNodeId ? [{ nodeId: user.orgNodeId, position: tenant.settings.positionLabels[user.role] || DEFAULT_POSITION_LABELS.member }] : [];
      if (typeof user.loginId !== 'string' || (!user.loginId && user.id === 'chair-1')) user.loginId = user.id === 'chair-1' ? 'parkjingam' : '';
      if (typeof user.passwordChangeRequired !== 'boolean') user.passwordChangeRequired = user.id === 'chair-1';
    }
    if (!tenant.updatedAt) tenant.updatedAt = tenant.createdAt || now();
  }
  for (const key of ['invitations', 'handoverPlans', 'activityReports', 'pilotRequests', 'notifications', 'imports']) if (!Array.isArray(data[key])) data[key] = [];
  for (const meeting of data.meetings || []) ensureMeetingModel(meeting, data);
  for (const proposal of data.proposals || []) ensureProposalCommunication(proposal);
  const historicalDemoMeeting = SEED_DEFAULTS.meetings.find((meeting) => meeting.id === 'meeting-0');
  if (historicalDemoMeeting && !data.meetings.some((meeting) => meeting.id === historicalDemoMeeting.id)) data.meetings.push(structuredClone(historicalDemoMeeting));
  syncRecordFiles(data);
  return data;
};

function createStore(dataFile = path.join(ROOT, 'data', 'governance.json')) {
  const read = () => {
    if (!fs.existsSync(dataFile)) {
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(dataFile, JSON.stringify(createSeed(), null, 2), 'utf8');
    }
    return normalizeData(JSON.parse(fs.readFileSync(dataFile, 'utf8')));
  };
  const write = (data) => {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    const temporary = `${dataFile}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(normalizeData(data), null, 2), 'utf8');
    fs.renameSync(temporary, dataFile);
  };
  return { read, write };
}

function createApp({ dataFile, googleOAuth = {}, kakaoOAuth = {} } = {}) {
  const store = createStore(dataFile);
  const importRoot = path.join(path.dirname(dataFile || path.join(ROOT, 'data', 'governance.json')), 'imports');
  const avatarRoot = path.join(path.dirname(dataFile || path.join(ROOT, 'data', 'governance.json')), 'avatars');
  const meetingPhotoRoot = path.join(path.dirname(dataFile || path.join(ROOT, 'data', 'governance.json')), 'meeting-photos');
  const pilotRequestRateLimit = new Map();
  const loginRateLimit = new Map();
  const notificationEmail = {
    resendApiKey: process.env.RESEND_API_KEY || '',
    to: process.env.PILOT_NOTIFICATION_TO || '',
    from: process.env.PILOT_NOTIFICATION_FROM || '',
  };
  const google = {
    clientId: googleOAuth.clientId || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: googleOAuth.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: googleOAuth.redirectUri || process.env.GOOGLE_REDIRECT_URI || '',
  };
  const kakao = {
    restApiKey: kakaoOAuth.restApiKey || process.env.KAKAO_REST_API_KEY || '',
    clientSecret: kakaoOAuth.clientSecret || process.env.KAKAO_CLIENT_SECRET || '',
    redirectUri: kakaoOAuth.redirectUri || process.env.KAKAO_REDIRECT_URI || '',
  };

  const pilotEmailConfigured = () => Boolean(notificationEmail.resendApiKey && notificationEmail.to && notificationEmail.from);
  const emailLooksValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  const cleanText = (value, max = 200) => String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, max);
  const avatarPath = (storedName) => {
    const safeName = path.basename(String(storedName || ''));
    if (!safeName || safeName !== storedName) return null;
    const resolved = path.resolve(avatarRoot, safeName);
    return resolved.startsWith(`${path.resolve(avatarRoot)}${path.sep}`) ? resolved : null;
  };
  const removeAvatar = (user) => {
    const file = avatarPath(user?.avatar?.storedName);
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
    delete user.avatar;
  };
  const meetingPhotoPath = (storedName) => {
    const safeName = path.basename(String(storedName || ''));
    if (!safeName || safeName !== storedName) return null;
    const resolved = path.resolve(meetingPhotoRoot, safeName);
    return resolved.startsWith(`${path.resolve(meetingPhotoRoot)}${path.sep}`) ? resolved : null;
  };
  const archiveHistoryEntry = (actor, tenant, type, detail = '') => ({ id: id('archive-history'), type, detail: cleanText(detail, 500), at: now(), actorId: actor.id, cohort: tenant.cohort || '기수 미정' });
  const archiveFolderFor = (data, tenantId, folderId) => data.archiveFolders.find((folder) => folder.id === folderId && folder.tenantId === tenantId);
  const sourceArchiveSnapshot = (data, tenantId, sourceType, sourceId) => {
    if (sourceType === 'meeting') { const item = data.meetings.find((entry) => entry.id === sourceId && entry.tenantId === tenantId); if (!item) return null; return { title: item.title, category: '회의 자료', body: `회의 일시: ${item.startsAt || '미정'}\n장소: ${item.location || '미정'}\n\n안건\n${(item.agenda || []).map((agenda) => `- ${agenda.title}`).join('\n') || '등록된 안건이 없습니다.'}\n\n회의록\n${item.minutes || '회의록 미입력'}\n\n결정·과제\n${(item.decisions || []).map((decision) => `- ${decision.text} · 담당 ${data.users.find((user) => user.id === decision.ownerId)?.name || '미정'} · ${decision.dueAt || '기한 미정'}`).join('\n') || '기록된 결정·과제가 없습니다.'}`, sourceLabel: '회의·일정', recordedAt: item.updatedAt || item.createdAt || item.startsAt }; }
    if (sourceType === 'proposal') { const item = data.proposals.find((entry) => entry.id === sourceId && entry.tenantId === tenantId); if (!item) return null; const sections = item.sections || {}; return { title: item.title, category: '정책 참고', body: `정책제안 상태: ${item.status}\n\n문제 정의\n${sections.problem || '미입력'}\n\n현장 근거\n${sections.evidence || '미입력'}\n\n제안 내용\n${sections.proposal || '미입력'}\n\n실행 주체·방식\n${sections.implementation || '미입력'}\n\n반론·제약\n${sections.risks || '미입력'}\n\n제출·경과\n${item.finalSubmission ? `${item.finalSubmission.destination} · ${item.finalSubmission.submittedAt}` : '제출 기록 없음'}\n${(item.progress || []).map((progress) => `- ${progress.body}`).join('\n')}`, sourceLabel: '정책제안', recordedAt: item.updatedAt || item.createdAt }; }
    if (sourceType === 'issue') { const item = data.issues.find((entry) => entry.id === sourceId && entry.tenantId === tenantId); if (!item) return null; return { title: item.title, category: '정책 참고', body: `출처: ${item.sourceName}\n확인일: ${item.checkedAt}\n\n운영 메모\n${item.editorNote || '메모 없음'}${item.sourceUrl ? `\n\n원문\n${item.sourceUrl}` : ''}`, sourceLabel: '이슈·공지', recordedAt: item.createdAt }; }
    if (sourceType === 'announcement') { const item = data.announcements.find((entry) => entry.id === sourceId && entry.tenantId === tenantId); if (!item) return null; return { title: item.title, category: '공지·이슈', body: `대상: ${item.target || '전체'}\n\n${item.body}`, sourceLabel: '이슈·공지', recordedAt: item.createdAt }; }
    if (sourceType === 'handover') { const item = data.handoverPlans.find((entry) => entry.id === sourceId && entry.tenantId === tenantId); if (!item) return null; return { title: `${item.sourceCohort} → ${item.targetCohort} 기수 인계`, category: '인수인계', body: `인계 요약\n${item.summary || '미입력'}\n\n우선 확인 항목\n${item.priorityItems || '미입력'}\n\n함께 선택한 아카이브 자료: ${(item.archiveItemIds || []).length}건`, sourceLabel: '기수 인계·리포트', recordedAt: item.completedAt || item.createdAt }; }
    if (sourceType === 'report') { const item = data.activityReports.find((entry) => entry.id === sourceId && entry.tenantId === tenantId); if (!item) return null; return { title: item.title, category: '활동 리포트', body: `${item.periodLabel || '기간 미정'}\n\n집계 방식\n${item.methodology || ''}\n\n잘 이어진 흐름\n${(item.insights?.strengths || []).map((value) => `- ${value}`).join('\n')}\n\n보완 지점\n${(item.insights?.gaps || []).map((value) => `- ${value}`).join('\n')}\n\n다음 행동\n${(item.insights?.actions || []).map((value) => `- ${value}`).join('\n')}`, sourceLabel: '기수 인계·리포트', recordedAt: item.createdAt }; }
    return null;
  };
  const importFilePath = (storedName) => {
    const candidate = path.resolve(importRoot, path.basename(String(storedName || '')));
    return path.relative(importRoot, candidate).startsWith('..') ? null : candidate;
  };
  const purgeExpiredImportSources = (data) => {
    let changed = false; const timestamp = Date.now();
    for (const imported of data.imports || []) {
      if (!imported.source?.storedName || !imported.source.retentionUntil || new Date(imported.source.retentionUntil).getTime() > timestamp) continue;
      const stored = importFilePath(imported.source.storedName); if (stored && fs.existsSync(stored)) fs.unlinkSync(stored);
      imported.source.storedName = null; imported.source.purgedAt = now(); imported.extractedTextPreview = ''; changed = true;
    }
    return changed;
  };
  const cleanImportProfile = (input = {}) => Object.fromEntries(ORGANIZATION_PROFILE_FIELDS.map((key) => [key, key === 'institutionType' ? (INSTITUTION_TYPES.has(input[key]) ? input[key] : '') : text(input[key], key === 'introduction' ? 1000 : key === 'ordinanceUrl' || key === 'logoUrl' ? 1000 : 240)]));
  const cleanImportMember = (input = {}) => ({
    id: text(input.id, 80) || id('import-member'), sourceRow: Number.isInteger(Number(input.sourceRow)) ? Number(input.sourceRow) : null, name: text(input.name, 80), email: text(input.email, 160), role: TENANT_ROLES.includes(input.role) ? input.role : roleFrom(input.role), term: text(input.term, 80), ageBand: text(input.ageBand, 40) || '응답하지 않음', job: text(input.job, 120), region: text(input.region, 120), included: input.included !== false, existingUserId: text(input.existingUserId, 80) || null,
  });
  const extractImport = (file, data, tenantId) => {
    const extension = path.extname(file.filename || '').toLowerCase(); let rows = []; let rawText = ''; let parser = 'manual_review'; let notes = [];
    try {
      if (extension === '.csv') { rows = csvRows(file.buffer.toString('utf8')); parser = 'csv_table'; }
      else if (extension === '.xlsx') { rows = xlsxRows(file.buffer); parser = 'xlsx_table'; }
      else if (extension === '.hwpx') { rawText = hwpxText(file.buffer); parser = 'hwpx_text'; notes.push('HWPX 표의 열 구조는 원본에 따라 달라질 수 있어, 명단 행을 반영하기 전에 위원장이 확인해야 합니다.'); }
      else if (extension === '.pdf') { rawText = pdfText(file.buffer); parser = rawText ? 'pdf_text_best_effort' : 'manual_review'; if (!rawText) notes.push('이 PDF는 텍스트를 안정적으로 읽지 못했습니다. 원본을 확인하며 기구 정보·명단을 직접 보완해 주세요.'); }
      else if (extension === '.txt') { rawText = file.buffer.toString('utf8'); parser = 'plain_text'; }
      else if (extension === '.hwp') notes.push('구형 HWP는 이 서버에서 안전하게 구조를 읽을 수 없습니다. 원본은 검토용으로 보관하고, HWPX·PDF·Excel로 저장한 뒤 다시 올리거나 추출 내용을 직접 보완해 주세요.');
      else notes.push('지원하지 않는 파일 형식입니다.');
    } catch (error) { notes.push(`${extension.toUpperCase().slice(1)} 내용을 자동 추출하지 못했습니다: ${text(error.message, 180)}`); parser = 'manual_review'; rows = []; rawText = ''; }
    const candidates = importCandidates(rows, rawText); candidates.members = candidates.members.map((member) => {
      const existing = member.email ? data.users.find((user) => user.tenantId === tenantId && String(user.email || '').toLowerCase() === member.email.toLowerCase()) : null;
      return cleanImportMember({ ...member, existingUserId: existing?.id || null });
    });
    if (!candidates.profile.displayName && !candidates.members.length) notes.push('자동으로 확인할 기구 정보나 명단 행이 없습니다. 아래 검토 화면에서 직접 추가할 수 있습니다.');
    return { parser, notes, organizationProfile: cleanImportProfile(candidates.profile), members: candidates.members, rowCount: rows.length, extractedTextPreview: text(rawText, 1200) };
  };
  const pilotNotificationText = (request) => [
    '새 파일럿 도입 문의가 접수되었습니다.',
    `접수 시각: ${request.createdAt}`,
    `기구명: ${request.organizationName}`,
    `담당자: ${request.contactName}`,
    `업무용 이메일: ${request.contactEmail}`,
    `연락처: ${request.contactPhone || '미입력'}`,
    `기구 유형: ${request.organization}`,
    `막힌 업무: ${request.blocker}`,
    `운영 재원: ${request.funding}`,
    '',
    '운영사 콘솔의 도입 문의에서 접수 상태를 확인하세요.',
  ].join('\n');
  const deliverPilotNotification = async (request) => {
    if (!pilotEmailConfigured()) return { channel: 'email', status: 'not_configured', attemptedAt: now() };
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${notificationEmail.resendApiKey}`, 'content-type': 'application/json', 'idempotency-key': `pilot-request-${request.id}` },
        body: JSON.stringify({ from: notificationEmail.from, to: [notificationEmail.to], subject: `[워크룸] 새 파일럿 문의 · ${request.organizationName}`, text: pilotNotificationText(request) }),
        signal: AbortSignal.timeout(8000),
      });
      const payload = await response.json().catch(() => ({}));
      return response.ok ? { channel: 'email', status: 'sent', provider: 'resend', providerMessageId: payload.id || null, attemptedAt: now() } : { channel: 'email', status: 'failed', provider: 'resend', attemptedAt: now() };
    } catch {
      return { channel: 'email', status: 'failed', provider: 'resend', attemptedAt: now() };
    }
  };
  const isPrivateAddress = (address) => {
    const ip = String(address || '').toLowerCase();
    if (ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:') || ip.startsWith('::ffff:')) return true;
    if (net.isIP(ip) !== 4) return false;
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  };
  const validatePressReleaseFeedUrl = async (value) => {
    const candidate = String(value || '').trim();
    if (!candidate) return null;
    let parsed;
    try { parsed = new URL(candidate); } catch { throw new Error('보도자료 피드 주소가 올바른 URL이 아닙니다.'); }
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || isPrivateAddress(hostname)) throw new Error('보도자료 피드는 공인 HTTPS 주소만 사용할 수 있습니다.');
    let addresses;
    try { addresses = await lookup(hostname, { all: true, verbatim: true }); } catch { throw new Error('보도자료 피드 도메인을 확인하지 못했습니다.'); }
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('보도자료 피드는 내부망 주소를 사용할 수 없습니다.');
    return parsed.toString();
  };
  const feedTag = (source, tags) => {
    for (const tag of tags) {
      const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(source);
      if (match) return xmlText(match[1].replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1'));
    }
    return '';
  };
  const feedLink = (source, baseUrl) => {
    const href = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i.exec(source)?.[1] || feedTag(source, ['link', 'guid', 'id']);
    try { const target = new URL(href, baseUrl); return target.protocol === 'https:' ? target.toString() : ''; } catch { return ''; }
  };
  const parsePressReleaseFeed = (document, feedBaseUrl) => {
    const blocks = [...String(document || '').matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].map((match) => match[1]);
    const unique = new Set();
    return blocks.map((block) => {
      const title = feedTag(block, ['title']).slice(0, 200); const sourceUrl = feedLink(block, feedBaseUrl); const publishedAt = feedTag(block, ['pubDate', 'published', 'updated', 'date']).slice(0, 120);
      const description = feedTag(block, ['description', 'summary', 'content']).slice(0, 500);
      const externalKey = crypto.createHash('sha256').update(`${sourceUrl}\n${title}`).digest('hex').slice(0, 32);
      return { title, sourceUrl, publishedAt, description, externalKey };
    }).filter((item) => item.title && item.sourceUrl && !unique.has(item.externalKey) && unique.add(item.externalKey)).slice(0, 50);
  };
  const collectPressReleaseFeed = async (data, tenant) => {
    const profile = ensureOrganizationProfile(tenant); const feedUrl = profile.pressReleaseFeedUrl || '';
    profile.pressReleaseCollection ||= { lastCheckedAt: null, lastSuccessAt: null, lastError: '', latestCount: 0 };
    const collection = profile.pressReleaseCollection;
    if (!feedUrl) return { configured: false, created: 0, checked: false };
    collection.lastCheckedAt = now(); collection.lastError = '';
    try {
      const validatedUrl = await validatePressReleaseFeedUrl(feedUrl);
      const response = await fetch(validatedUrl, { redirect: 'error', headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1', 'user-agent': 'GovernanceWorkroomPressFeed/0.1' }, signal: AbortSignal.timeout(12000) });
      const length = Number(response.headers.get('content-length') || 0);
      if (!response.ok) throw new Error(`피드 응답 ${response.status}`);
      if (length > PRESS_RELEASE_MAX_BYTES) throw new Error('피드 파일이 1MB 제한을 넘습니다.');
      const payload = Buffer.from(await response.arrayBuffer()); if (payload.length > PRESS_RELEASE_MAX_BYTES) throw new Error('피드 파일이 1MB 제한을 넘습니다.');
      const entries = parsePressReleaseFeed(payload.toString('utf8'), validatedUrl);
      const sourceName = cleanText(profile.pressReleaseSourceName || profile.institutionName || tenant.name, 120);
      const existingKeys = new Set(data.issues.filter((item) => item.tenantId === tenant.id && item.sourceType === 'institution_press_release').map((item) => item.externalKey).filter(Boolean));
      const added = entries.filter((entry) => !existingKeys.has(entry.externalKey)).map((entry) => ({ id: id('issue'), tenantId: tenant.id, title: entry.title, sourceName, sourceUrl: entry.sourceUrl, checkedAt: now().slice(0, 10), editorNote: entry.description || '소속기관 보도자료 피드에서 자동 수집했습니다.', visibility: 'tenant', sourceType: 'institution_press_release', externalKey: entry.externalKey, publishedAt: entry.publishedAt || null, createdBy: null, createdAt: now() }));
      if (added.length) {
        data.issues.unshift(...added);
        const recipients = data.users.filter((user) => user.tenantId === tenant.id && user.active && user.role !== 'platform_admin').map((user) => user.id);
        notifyUsers(data, recipients, { tenantId: tenant.id, kind: 'institution_press_release', title: `${sourceName} 새 보도자료 ${added.length}건`, body: added.slice(0, 3).map((item) => item.title).join(' · ') });
      }
      collection.lastSuccessAt = now(); collection.latestCount = added.length;
      return { configured: true, created: added.length, checked: true, total: entries.length };
    } catch (error) {
      collection.lastError = cleanText(error.message || '보도자료 피드를 확인하지 못했습니다.', 240); collection.latestCount = 0;
      return { configured: true, created: 0, checked: true, error: collection.lastError };
    }
  };

  const audit = (data, actor, action, resource, detail = {}) => {
    data.auditLogs.unshift({ id: id('audit'), actorId: actor.id, tenantId: actor.tenantId, action, resource, detail, at: now() });
    data.auditLogs = data.auditLogs.slice(0, 300);
  };
  const securityHeaders = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  };
  const json = (res, status, payload, headers = {}) => {
    res.writeHead(status, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
    res.end(JSON.stringify(payload));
  };
  const binary = (res, status, payload, contentType, headers = {}) => {
    res.writeHead(status, { ...securityHeaders, 'content-type': contentType, 'cache-control': 'no-store', 'content-length': payload.length, ...headers });
    res.end(payload);
  };
  const html = (res, status, payload) => {
    res.writeHead(status, { ...securityHeaders, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(payload);
  };
  const sendError = (res, status, message) => json(res, status, { error: message });
  const redirect = (res, location, headers = {}) => { res.writeHead(302, { location, 'cache-control': 'no-store', ...headers }); res.end(); };
  const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((entry) => entry.trim().split(/=(.*)/s)).filter(([key]) => key).map(([key, value]) => [key, decodeURIComponent(value || '')]));
  const secureCookie = (req) => req.socket.encrypted || process.env.SESSION_COOKIE_SECURE === 'true';
  const sessionCookie = (token, req) => `workroom_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secureCookie(req) ? '; Secure' : ''}`;
  const clearSessionCookie = (req) => `workroom_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie(req) ? '; Secure' : ''}`;
  const parseBody = async (req) => new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 1_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('요청 본문이 올바른 JSON 형식이 아닙니다.')); } });
    req.on('error', reject);
  });
  const parseMultipart = async (req) => new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || ''); const boundary = /boundary=([^;]+)/i.exec(contentType)?.[1]?.replace(/^"|"$/g, '');
    if (!boundary) return reject(new Error('업로드 형식을 확인하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.'));
    const chunks = []; let size = 0; let tooLarge = false;
    req.on('data', (chunk) => { size += chunk.length; if (size > MAX_IMPORT_BYTES + 256_000) { tooLarge = true; return; } chunks.push(chunk); });
    req.on('end', () => {
      try {
        if (tooLarge) return reject(new Error('파일은 10MB 이하만 올릴 수 있습니다.'));
        const body = Buffer.concat(chunks); const marker = Buffer.from(`--${boundary}`); const fields = {}; const files = []; let cursor = 0;
        while (cursor < body.length) {
          const start = body.indexOf(marker, cursor); if (start < 0) break; cursor = start + marker.length;
          if (body.subarray(cursor, cursor + 2).equals(Buffer.from('--'))) break;
          if (body.subarray(cursor, cursor + 2).equals(Buffer.from('\r\n'))) cursor += 2;
          const next = body.indexOf(marker, cursor); if (next < 0) break;
          const part = body.subarray(cursor, next - 2); const headerEnd = part.indexOf(Buffer.from('\r\n\r\n')); if (headerEnd < 0) { cursor = next; continue; }
          const headers = part.subarray(0, headerEnd).toString('utf8'); const payload = part.subarray(headerEnd + 4); const disposition = /content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i.exec(headers);
          if (!disposition) { cursor = next; continue; }
          const [, name, filename] = disposition;
          if (filename !== undefined && filename !== '') files.push({ name, filename, contentType: /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1] || '', buffer: payload });
          else fields[name] = text(payload.toString('utf8'), 500);
          cursor = next;
        }
        resolve({ fields, files });
      } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
  const sessionToken = (req, data) => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const candidates = [bearer, cookies(req).workroom_session].filter(Boolean);
    return candidates.find((token) => data.sessions.find((entry) => entry.token === token && entry.expiresAt > now())) || null;
  };
  const actorFrom = (req, data) => {
    const token = sessionToken(req, data);
    const session = data.sessions.find((entry) => entry.token === token && entry.expiresAt > now());
    const user = session ? data.users.find((entry) => entry.id === session.userId && entry.active) : null;
    if (!user) return null;
    const tenant = data.tenants.find((entry) => entry.id === user.tenantId); if (tenant) ensureTenantGovernanceSettings(tenant);
    return tenant ? { ...user, tenantPermissions: tenant.settings.rolePermissions } : user;
  };
  const createSession = (data, user) => {
    data.sessions = data.sessions.filter((session) => session.expiresAt > now());
    const token = crypto.randomBytes(32).toString('hex');
    data.sessions.push({ token, userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString() });
    return token;
  };
  const googleRedirectUri = (req) => google.redirectUri || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || `localhost:${PORT}`}/api/auth/google/callback`;
  const kakaoRedirectUri = (req) => kakao.redirectUri || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || `localhost:${PORT}`}/api/auth/kakao/callback`;
  const canSeeTenant = (actor, tenantId) => actor.role === 'platform_admin' || actor.tenantId === tenantId;
  const canManageTenant = (actor, tenantId, permission = 'manage') => actor.role === 'platform_admin' || (actor.tenantId === tenantId && Boolean(actor.tenantPermissions?.[actor.role]?.[permission]));
  const canReviewImports = (actor, tenantId) => actor.role === 'platform_admin' || (actor.tenantId === tenantId && actor.role === 'chair');
  const proposalVisible = (actor, proposal) => canSeeTenant(actor, proposal.tenantId) && (actor.role !== 'reviewer' || (actor.assignedProposalIds || []).includes(proposal.id));
  const canEditProposal = (actor, proposal) => canManageTenant(actor, proposal.tenantId) || proposalRecipients(proposal).includes(actor.id);
  const requireActor = (req, res, data) => {
    const actor = actorFrom(req, data);
    if (!actor) { sendError(res, 401, '로그인이 필요하거나 세션이 만료되었습니다.'); return null; }
    if (actor.role !== 'platform_admin') {
      const tenant = data.tenants.find((entry) => entry.id === actor.tenantId);
      if (!tenant?.active) { sendError(res, 403, '이 위원회 공간은 현재 중지되어 있습니다. 운영사에 문의해 주세요.'); return null; }
    }
    return actor;
  };
  const tenantFor = (actor, requestedTenantId) => actor.role === 'platform_admin' ? requestedTenantId : actor.tenantId;
  const requirePlatformAdmin = (actor, res) => {
    if (actor.role !== 'platform_admin') { sendError(res, 403, '운영사 관리 콘솔은 운영사 관리자만 사용할 수 있습니다.'); return false; }
    return true;
  };
  const requireSameOriginForCookieMutation = (req, res) => {
    if (!req.headers.cookie || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const origin = req.headers.origin;
    const expected = `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
    if (origin && origin === expected) return true;
    sendError(res, 403, '브라우저 요청의 출처를 확인하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
    return false;
  };
  const requestAddress = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const serviceAccessUsable = (tenant) => {
    const access = tenant?.serviceAccess || {};
    if (access.dataMode === 'synthetic_demo') return true;
    if (access.status !== 'active') return false;
    const today = now().slice(0, 10);
    if (access.startsAt && today < access.startsAt) return false;
    if (access.endsAt && today > access.endsAt) return false;
    return true;
  };
  const platformData = (data) => ({
    tenantTemplates: data.tenantTemplates || [],
    contentReviews: data.contentReviews || [],
    consultationAssignments: data.consultationAssignments || [],
    casePublicationRequests: data.casePublicationRequests || [],
    researchRequests: data.researchRequests || [],
    consentVersions: data.consentVersions || [],
    retentionPolicies: data.retentionPolicies || [],
    systemNotices: data.systemNotices || [],
    pilotRequests: data.pilotRequests || [],
    pilotEmailNotificationsConfigured: pilotEmailConfigured(),
  });
  const publicData = (data, actor) => {
    const tenantIds = actor.role === 'platform_admin' ? data.tenants.map((tenant) => tenant.id) : [actor.tenantId];
    const inTenant = (item) => tenantIds.includes(item.tenantId);
    const proposals = data.proposals.filter((proposal) => proposalVisible(actor, proposal)).map((proposal) => {
      if (canManageTenant(actor, proposal.tenantId) || proposalRecipients(proposal).includes(actor.id)) return proposal;
      const delivery = proposal.institutionDelivery;
      return {
        id: proposal.id, tenantId: proposal.tenantId, title: proposal.title, topic: proposal.topic, status: proposal.status,
        ownerId: null, contributors: [], sections: {}, versions: [], feedback: [], consultation: null, finalSubmission: null, progress: [],
        institutionDelivery: delivery ? { status: delivery.status, submittedAt: delivery.submittedAt || null, receivedAt: delivery.receivedAt || null, response: delivery.response ? { createdAt: delivery.response.createdAt } : null } : null,
        createdAt: proposal.createdAt, updatedAt: proposal.updatedAt,
      };
    });
    const users = data.users.filter((user) => actor.role === 'platform_admin' || user.tenantId === actor.tenantId).map(safeUser);
    const tenants = data.tenants.filter((tenant) => tenantIds.includes(tenant.id)).map((tenant) => {
      const visible = structuredClone(tenant);
      if (!canManageTenant(actor, tenant.id) && visible.settings?.orgChart) delete visible.settings.orgChart.history;
      return visible;
    });
    const meetings = data.meetings.filter(inTenant).map((meeting) => ({ ...meeting, minutesPhotos: (meeting.minutesPhotos || []).map(({ storedName, ...photo }) => ({ ...photo, url: `/api/meeting-photos/${encodeURIComponent(meeting.id)}/${encodeURIComponent(photo.id)}` })) }));
    const actorNodeIds = new Set([actor.orgNodeId, ...(actor.orgAssignments || []).map((entry) => entry.nodeId)].filter(Boolean));
    const announcements = data.announcements.filter(inTenant).filter((item) => item.target !== 'division' || canManageTenant(actor, item.tenantId) || actorNodeIds.has(item.orgNodeId));
    return {
      me: safeUser(actor), roles: ROLES,
      tenants, users,
      meetings, proposals,
      notifications: data.notifications.filter((item) => item.userId === actor.id && inTenant(item)).slice(0, 60),
      issues: data.issues.filter(inTenant), announcements, archiveFolders: data.archiveFolders.filter(inTenant), archiveItems: data.archiveItems.filter(inTenant), recordFiles: data.recordFiles.filter(inTenant),
      documentPackages: canManageTenant(actor, actor.tenantId) || actor.role === 'platform_admin' ? data.documentPackages.filter(inTenant) : [],
      invitations: canManageTenant(actor, actor.tenantId) || actor.role === 'platform_admin' ? data.invitations.filter(inTenant).map((invitation) => {
        const itemTenant = data.tenants.find((tenant) => tenant.id === invitation.tenantId);
        const invitationUrl = `/join/${invitation.token}`;
        return { ...invitation, invitationUrl, invitationCopy: buildInvitationCopy(itemTenant, invitation, invitationUrl) };
      }) : [],
      handoverPlans: canManageTenant(actor, actor.tenantId) || actor.role === 'platform_admin' ? data.handoverPlans.filter(inTenant) : [],
      activityReports: canManageTenant(actor, actor.tenantId) || actor.role === 'platform_admin' ? data.activityReports.filter(inTenant) : [],
      imports: canReviewImports(actor, actor.tenantId) || actor.role === 'platform_admin' ? data.imports.filter(inTenant).map((entry) => ({ ...entry, source: { ...entry.source, storedName: undefined }, extractedTextPreview: undefined })) : [],
      aiReportReviewConfigured: Boolean(OPENAI_API_KEY),
      aiProposalAssistConfigured: Boolean(OPENAI_API_KEY),
      communityPosts: data.communityPosts.filter((post) => inTenant(post) || post.visibility === 'approved_public'),
      deletionRequests: data.deletionRequests.filter((request) => actor.role === 'platform_admin' || request.requestedBy === actor.id || request.tenantId === actor.tenantId),
      auditLogs: actor.role === 'platform_admin' ? data.auditLogs : data.auditLogs.filter((log) => log.tenantId === actor.tenantId).slice(0, 80),
      platform: actor.role === 'platform_admin' ? platformData(data) : null,
    };
  };

  const api = async (req, res, url) => {
    let data = store.read();
    if (purgeExpiredImportSources(data)) store.write(data);
    const { pathname } = url;
    if (req.method === 'GET' && pathname === '/api/auth/providers') return json(res, 200, { google: Boolean(google.clientId && google.clientSecret), kakao: Boolean(kakao.restApiKey && kakao.clientSecret) });
    if (req.method === 'GET' && pathname === '/api/auth/google/start') {
      if (!google.clientId || !google.clientSecret) return sendError(res, 503, '구글 로그인이 아직 설정되지 않았습니다. GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 설정해 주세요.');
      const state = crypto.randomBytes(32).toString('hex');
      data.oauthStates = (data.oauthStates || []).filter((entry) => entry.expiresAt > now());
      data.oauthStates.push({ state, provider: 'google', expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString() });
      store.write(data);
      const params = new URLSearchParams({ client_id: google.clientId, redirect_uri: googleRedirectUri(req), response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
      return redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    }
    if (req.method === 'GET' && pathname === '/api/auth/google/callback') {
      const state = url.searchParams.get('state');
      const stateRecord = (data.oauthStates || []).find((entry) => entry.state === state && entry.provider === 'google' && entry.expiresAt > now());
      data.oauthStates = (data.oauthStates || []).filter((entry) => entry.state !== state && entry.expiresAt > now());
      store.write(data);
      if (url.searchParams.get('error') || !stateRecord || !url.searchParams.get('code')) return redirect(res, '/login?google=cancelled');
      try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: url.searchParams.get('code'), client_id: google.clientId, client_secret: google.clientSecret, redirect_uri: googleRedirectUri(req), grant_type: 'authorization_code' }) });
        const tokenPayload = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error('token_exchange_failed');
        const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${tokenPayload.access_token}` } });
        const profile = await profileResponse.json();
        if (!profileResponse.ok || !profile.email || profile.email_verified !== true) throw new Error('unverified_email');
        data = store.read();
        const user = data.users.find((entry) => String(entry.email || '').toLowerCase() === String(profile.email).toLowerCase() && entry.active);
        if (!user) return redirect(res, '/login?google=not_invited');
        const token = createSession(data, user); audit(data, user, 'google_login', 'session'); store.write(data);
        return redirect(res, '/login?google=success', { 'set-cookie': sessionCookie(token, req) });
      } catch {
        return redirect(res, '/login?google=failed');
      }
    }
    if (req.method === 'GET' && pathname === '/api/auth/kakao/start') {
      if (!kakao.restApiKey || !kakao.clientSecret) return sendError(res, 503, '카카오 로그인이 아직 설정되지 않았습니다. KAKAO_REST_API_KEY와 KAKAO_CLIENT_SECRET을 설정해 주세요.');
      const state = crypto.randomBytes(32).toString('hex');
      data.oauthStates = (data.oauthStates || []).filter((entry) => entry.expiresAt > now());
      data.oauthStates.push({ state, provider: 'kakao', expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString() });
      store.write(data);
      const params = new URLSearchParams({ client_id: kakao.restApiKey, redirect_uri: kakaoRedirectUri(req), response_type: 'code', state, scope: 'account_email', prompt: 'select_account' });
      return redirect(res, `https://kauth.kakao.com/oauth/authorize?${params}`);
    }
    if (req.method === 'GET' && pathname === '/api/auth/kakao/callback') {
      const state = url.searchParams.get('state');
      const stateRecord = (data.oauthStates || []).find((entry) => entry.state === state && entry.provider === 'kakao' && entry.expiresAt > now());
      data.oauthStates = (data.oauthStates || []).filter((entry) => entry.state !== state && entry.expiresAt > now());
      store.write(data);
      if (url.searchParams.get('error') || !stateRecord || !url.searchParams.get('code')) return redirect(res, '/login?kakao=cancelled');
      try {
        const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: kakao.restApiKey, client_secret: kakao.clientSecret, redirect_uri: kakaoRedirectUri(req), code: url.searchParams.get('code') }) });
        const tokenPayload = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error('token_exchange_failed');
        const profileResponse = await fetch('https://kapi.kakao.com/v2/user/me', { headers: { authorization: `Bearer ${tokenPayload.access_token}` } });
        const profile = await profileResponse.json();
        const account = profile.kakao_account || {};
        if (!profileResponse.ok || !account.email || account.is_email_valid !== true || account.is_email_verified !== true) throw new Error('unverified_email');
        data = store.read();
        const user = data.users.find((entry) => String(entry.email || '').toLowerCase() === String(account.email).toLowerCase() && entry.active);
        if (!user) return redirect(res, '/login?kakao=not_invited');
        const token = createSession(data, user); audit(data, user, 'kakao_login', 'session'); store.write(data);
        return redirect(res, '/login?kakao=success', { 'set-cookie': sessionCookie(token, req) });
      } catch {
        return redirect(res, '/login?kakao=failed');
      }
    }
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const { email, identifier, password } = await parseBody(req); const loginIdentifier = String(identifier || email || '').trim().toLowerCase();
      const rateKey = `${requestAddress(req)}:${loginIdentifier}`;
      const attempts = (loginRateLimit.get(rateKey) || []).filter((timestamp) => Date.now() - timestamp < 15 * 60 * 1000);
      if (attempts.length >= 10) {
        res.setHeader('retry-after', '900');
        return sendError(res, 429, '로그인 시도가 잠시 제한되었습니다. 15분 뒤 다시 시도해 주세요.');
      }
      const user = data.users.find((entry) => entry.active && (String(entry.email || '').toLowerCase() === loginIdentifier || String(entry.loginId || '').toLowerCase() === loginIdentifier));
      if (!user || !verifyPassword(String(password || ''), user)) {
        attempts.push(Date.now()); loginRateLimit.set(rateKey, attempts);
        return sendError(res, 401, '로그인 아이디 또는 이메일, 비밀번호가 맞지 않습니다.');
      }
      loginRateLimit.delete(rateKey);
      const token = createSession(data, user);
      audit(data, user, 'login', 'session'); store.write(data);
      return json(res, 200, { token, me: safeUser(user) }, { 'set-cookie': sessionCookie(token, req) });
    }
    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      const token = sessionToken(req, data);
      data.sessions = data.sessions.filter((session) => session.token !== token); store.write(data);
      res.setHeader('set-cookie', clearSessionCookie(req)); return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && pathname === '/api/pilot-requests') {
      const remoteAddress = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
      const recentAttempts = (pilotRequestRateLimit.get(remoteAddress) || []).filter((timestamp) => Date.now() - timestamp < 15 * 60 * 1000);
      if (recentAttempts.length >= 5) return sendError(res, 429, '잠시 뒤 다시 시도해 주세요. 같은 접수 경로에서 짧은 시간에 여러 요청을 받을 수 없습니다.');
      const body = await parseBody(req);
      if (cleanText(body.website, 120)) return sendError(res, 400, '접수 내용을 확인하지 못했습니다. 입력 내용을 다시 확인해 주세요.');
      const organizationName = cleanText(body.organizationName, 160); const contactName = cleanText(body.contactName, 80); const contactEmail = cleanText(body.contactEmail, 160);
      const organization = cleanText(body.organization, 80); const blocker = cleanText(body.blocker, 160); const funding = cleanText(body.funding, 160);
      if (!organizationName || !contactName || !emailLooksValid(contactEmail) || !organization || !blocker || !funding || body.inquiryConsent !== true) return sendError(res, 400, '기구명, 담당자 이름, 업무용 이메일, 점검 항목과 문의 처리 동의를 확인해 주세요.');
      recentAttempts.push(Date.now()); pilotRequestRateLimit.set(remoteAddress, recentAttempts);
      const request = {
        id: id('pilot-request'), organizationName, contactName, contactEmail, contactPhone: cleanText(body.contactPhone, 40), organization, blocker, funding,
        status: 'received', consentAt: now(), source: 'public_pilot', createdAt: now(),
        notification: { inApp: 'recorded', email: pilotEmailConfigured() ? { channel: 'email', status: 'pending' } : { channel: 'email', status: 'not_configured' } },
      };
      data.pilotRequests.unshift(request); audit(data, { id: 'public-pilot', tenantId: null }, 'pilot_request_received', request.id, { source: request.source }); store.write(data);
      void deliverPilotNotification(request).then((email) => {
        const latest = store.read(); const saved = latest.pilotRequests.find((item) => item.id === request.id);
        if (!saved) return;
        saved.notification.email = email; store.write(latest);
      });
      return json(res, 201, { id: request.id, status: request.status, message: '도입 문의를 접수했습니다. 운영사 접수함에 기록했습니다.' });
    }
    const publicInvitationMatch = pathname.match(/^\/api\/invitations\/([^/]+)\/public$/);
    if (req.method === 'GET' && publicInvitationMatch) {
      const invitation = data.invitations.find((entry) => entry.token === publicInvitationMatch[1]);
      const tenant = invitation && data.tenants.find((entry) => entry.id === invitation.tenantId);
      if (!invitation || !tenant || invitation.status !== 'sent' || invitation.expiresAt <= now()) return sendError(res, 404, '사용할 수 없거나 만료된 초대 링크입니다.');
      return json(res, 200, { tenantName: tenant.name, cohort: invitation.term || tenant.cohort, role: invitation.role, roleLabel: ROLES[invitation.role], expiresAt: invitation.expiresAt, emailMasked: invitation.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') });
    }
    const publicInvitationAcceptMatch = pathname.match(/^\/api\/invitations\/([^/]+)\/accept$/);
    if (req.method === 'POST' && publicInvitationAcceptMatch) {
      const invitation = data.invitations.find((entry) => entry.token === publicInvitationAcceptMatch[1]);
      const body = await parseBody(req); const tenant = invitation && data.tenants.find((entry) => entry.id === invitation.tenantId);
      if (!invitation || !tenant || invitation.status !== 'sent' || invitation.expiresAt <= now()) return sendError(res, 404, '사용할 수 없거나 만료된 초대 링크입니다.');
      if (!body.name?.trim() || String(body.password || '').length < 8) return sendError(res, 400, '이름과 8자 이상 비밀번호를 입력해 주세요.');
      if (data.users.some((entry) => entry.email === invitation.email)) return sendError(res, 409, '이미 등록된 이메일입니다. 위원장에게 가입 상태를 확인해 주세요.');
      const salt = crypto.randomBytes(12).toString('hex'); const applicant = { id: id('user'), name: String(body.name).trim().slice(0, 80), email: invitation.email, role: invitation.role, tenantId: invitation.tenantId, active: false, term: invitation.term, ageBand: body.ageBand || '응답하지 않음', job: String(body.job || '').slice(0, 120), region: String(body.region || '').slice(0, 120), orgNodeId: null, orgAssignments: [], passwordSalt: salt, passwordHash: crypto.scryptSync(String(body.password), salt, 64).toString('hex'), invitationStatus: 'pending_approval', joinedAt: now() };
      data.users.push(applicant); invitation.status = 'pending_approval'; invitation.applicantUserId = applicant.id; invitation.acceptedAt = now(); audit(data, { ...applicant, active: true }, 'invitation_accepted_pending', invitation.id); store.write(data);
      return json(res, 201, { status: 'pending_approval', message: '가입 정보를 보냈습니다. 위원장 승인 후 로그인할 수 있습니다.' });
    }
    const actor = requireActor(req, res, data); if (!actor) return;
    if (!requireSameOriginForCookieMutation(req, res)) return;
    if (req.method === 'GET' && pathname === '/api/bootstrap') return json(res, 200, publicData(data, actor));
    const recordFileOutputMatch = pathname.match(/^\/api\/record-files\/([^/]+)\/(docx|print)$/);
    if (req.method === 'GET' && recordFileOutputMatch) {
      const item = (data.recordFiles || []).find((entry) => entry.id === recordFileOutputMatch[1]);
      if (!item || !canSeeTenant(actor, item.tenantId)) return sendError(res, 404, '기록 파일을 찾을 수 없습니다.');
      const version = item.versions?.[0]; if (!version) return sendError(res, 409, '내보낼 기록 버전이 없습니다.');
      const document = { title: item.title, recipient: '', summary: `기록 파일 · v${version.version} · ${item.category}`, sources: [{ title: item.title, category: item.category, body: version.body }] };
      if (recordFileOutputMatch[2] === 'docx') return binary(res, 200, docxFromPackage(document), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { 'content-disposition': 'attachment; filename="governance-record.docx"' });
      return html(res, 200, printableDocumentHtml(document));
    }
    const documentPackageOutputMatch = pathname.match(/^\/api\/document-packages\/([^/]+)\/(docx|print)$/);
    if (req.method === 'GET' && documentPackageOutputMatch) {
      const item = (data.documentPackages || []).find((entry) => entry.id === documentPackageOutputMatch[1]);
      if (!item || !canManageTenant(actor, item.tenantId)) return sendError(res, 404, '통합 자료를 찾을 수 없습니다.');
      if (documentPackageOutputMatch[2] === 'docx') return binary(res, 200, docxFromPackage(item), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { 'content-disposition': 'attachment; filename="integrated-governance-document.docx"' });
      return html(res, 200, printableDocumentHtml(item));
    }
    if (req.method === 'PATCH' && pathname === '/api/me/profile') {
      const body = await parseBody(req); const name = cleanText(body.name, 80);
      if (!name) return sendError(res, 400, '이름을 입력해 주세요.');
      actor.name = name; actor.ageBand = cleanText(body.ageBand, 40) || '응답하지 않음'; actor.job = cleanText(body.job, 120); actor.region = cleanText(body.region, 120);
      audit(data, actor, 'personal_profile_updated', actor.id); store.write(data); return json(res, 200, safeUser(actor));
    }
    const notificationMatch = pathname.match(/^\/api\/notifications\/([^/]+)$/);
    if (req.method === 'PATCH' && notificationMatch) {
      const notification = data.notifications.find((item) => item.id === notificationMatch[1] && item.userId === actor.id);
      if (!notification) return sendError(res, 404, '알림을 찾을 수 없습니다.');
      const body = await parseBody(req);
      if (body.read === true) notification.readAt ||= now();
      audit(data, actor, 'notification_read', notification.id, { tenantId: notification.tenantId }); store.write(data); return json(res, 200, notification);
    }
    if (req.method === 'POST' && pathname === '/api/account/password') {
      const body = await parseBody(req); const currentPassword = String(body.currentPassword || ''); const newPassword = String(body.newPassword || '');
      if (!verifyPassword(currentPassword, actor)) return sendError(res, 400, '현재 비밀번호를 확인해 주세요.');
      if (newPassword.length < 12) return sendError(res, 400, '새 비밀번호는 12자 이상으로 설정해 주세요.');
      const record = data.users.find((entry) => entry.id === actor.id); const salt = crypto.randomBytes(16).toString('hex'); record.passwordSalt = salt; record.passwordHash = crypto.scryptSync(newPassword, salt, 64).toString('hex'); record.passwordChangeRequired = false;
      const currentToken = sessionToken(req, data); data.sessions = data.sessions.filter((session) => session.userId !== actor.id || session.token === currentToken); audit(data, actor, 'password_changed', 'account'); store.write(data); return json(res, 200, { message: '비밀번호를 변경했습니다.' });
    }
    const avatarMatch = pathname.match(/^\/api\/avatars\/([^/]+)$/);
    if (req.method === 'GET' && avatarMatch) {
      const user = data.users.find((entry) => entry.id === avatarMatch[1]);
      const file = avatarPath(user?.avatar?.storedName);
      if (!user || !canSeeTenant(actor, user.tenantId) || !file || !fs.existsSync(file)) return sendError(res, 404, '프로필 사진을 찾을 수 없습니다.');
      res.writeHead(200, { ...securityHeaders, 'content-type': user.avatar.contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      return fs.createReadStream(file).pipe(res);
    }
    const meetingPhotoReadMatch = pathname.match(/^\/api\/meeting-photos\/([^/]+)\/([^/]+)$/);
    if (req.method === 'GET' && meetingPhotoReadMatch) {
      const meeting = data.meetings.find((entry) => entry.id === meetingPhotoReadMatch[1]);
      const photo = meeting?.minutesPhotos?.find((entry) => entry.id === meetingPhotoReadMatch[2]);
      const file = meetingPhotoPath(photo?.storedName);
      if (!meeting || !photo || !canSeeTenant(actor, meeting.tenantId) || !file || !fs.existsSync(file)) return sendError(res, 404, '회의 사진을 찾을 수 없습니다.');
      res.writeHead(200, { ...securityHeaders, 'content-type': photo.contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      return fs.createReadStream(file).pipe(res);
    }
    if (req.method === 'POST' && pathname === '/api/me/avatar') {
      const { files } = await parseMultipart(req); const file = files.find((entry) => entry.name === 'avatar');
      const type = file && imageType(file.buffer);
      if (!file || !type || !['image/png', 'image/jpeg', 'image/webp'].includes(file.contentType.toLowerCase())) return sendError(res, 400, 'PNG, JPG, WebP 이미지 파일만 등록할 수 있습니다.');
      if (!file.buffer.length || file.buffer.length > MAX_AVATAR_BYTES) return sendError(res, 400, '프로필 사진은 2MB 이하만 등록할 수 있습니다.');
      const record = data.users.find((entry) => entry.id === actor.id); const storedName = `avatar-${record.id}-${crypto.randomUUID().slice(0, 12)}${type.extension}`;
      fs.mkdirSync(avatarRoot, { recursive: true }); removeAvatar(record); fs.writeFileSync(path.join(avatarRoot, storedName), file.buffer, { flag: 'wx' });
      record.avatar = { storedName, contentType: type.contentType, updatedAt: now() };
      audit(data, actor, 'personal_avatar_updated', actor.id, { contentType: type.contentType, byteSize: file.buffer.length }); store.write(data); return json(res, 201, safeUser(record));
    }
    if (req.method === 'DELETE' && pathname === '/api/me/avatar') {
      const record = data.users.find((entry) => entry.id === actor.id); if (!record.avatar) return sendError(res, 404, '등록된 프로필 사진이 없습니다.');
      removeAvatar(record); audit(data, actor, 'personal_avatar_removed', actor.id); store.write(data); return json(res, 200, safeUser(record));
    }
    const actorTenant = data.tenants.find((tenant) => tenant.id === actor.tenantId);
    if (actor.role !== 'platform_admin' && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && !serviceAccessUsable(actorTenant)) {
      const status = actorTenant?.serviceAccess?.status === 'expired' || (actorTenant?.serviceAccess?.endsAt && now().slice(0, 10) > actorTenant.serviceAccess.endsAt) ? '이용 기간이 끝났습니다.' : actorTenant?.serviceAccess?.dataMode === 'template_only' ? '템플릿·체험에서는 실제 운영 기록을 저장할 수 없습니다.' : '기관 계약 또는 후원 좌석의 이용 조건이 아직 활성화되지 않았습니다.';
      return sendError(res, 403, `${status} 운영사에 이용 조건을 확인해 주세요.`);
    }
    const meetingPhotoCreateMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/minutes-photos$/);
    if (req.method === 'POST' && meetingPhotoCreateMatch) {
      const meeting = data.meetings.find((entry) => entry.id === meetingPhotoCreateMatch[1]);
      if (!meeting || !canManageTenant(actor, meeting.tenantId)) return sendError(res, 403, '회의 사진을 등록할 권한이 없습니다.');
      const { fields, files } = await parseMultipart(req); const file = files.find((entry) => entry.name === 'photo'); const type = file && imageType(file.buffer);
      if (!file || !type || !['image/png', 'image/jpeg', 'image/webp'].includes(file.contentType.toLowerCase())) return sendError(res, 400, 'PNG, JPG, WebP 이미지 파일만 등록할 수 있습니다.');
      if (!file.buffer.length || file.buffer.length > MAX_MEETING_PHOTO_BYTES) return sendError(res, 400, '회의 사진은 5MB 이하만 등록할 수 있습니다.');
      ensureMeetingModel(meeting, data); const photoId = id('meeting-photo'); const storedName = `${photoId}-${crypto.randomUUID().slice(0, 12)}${type.extension}`;
      fs.mkdirSync(meetingPhotoRoot, { recursive: true }); fs.writeFileSync(path.join(meetingPhotoRoot, storedName), file.buffer, { flag: 'wx' });
      const photo = { id: photoId, storedName, contentType: type.contentType, byteSize: file.buffer.length, caption: cleanText(fields.caption, 160), createdBy: actor.id, createdAt: now() };
      meeting.minutesPhotos.push(photo); meeting.updatedAt = now(); audit(data, actor, 'meeting_photo_added', meeting.id, { photoId, contentType: type.contentType, byteSize: file.buffer.length }); store.write(data);
      return json(res, 201, { ...photo, storedName: undefined, url: `/api/meeting-photos/${encodeURIComponent(meeting.id)}/${encodeURIComponent(photo.id)}` });
    }
    if (req.method === 'POST' && pathname === '/api/imports') {
      if (!canReviewImports(actor, actor.tenantId)) return sendError(res, 403, '위원회 자료는 위원장만 검토용으로 올릴 수 있습니다.');
      const { fields, files } = await parseMultipart(req); const file = files.find((entry) => entry.name === 'file' || entry.name === 'source'); const tenantId = tenantFor(actor, fields.tenantId);
      if (!tenantId || !canReviewImports(actor, tenantId)) return sendError(res, 403, '대상 위원회의 자료 검토 권한이 없습니다.');
      const originalName = path.basename(String(file?.filename || '')).replace(/[^\p{L}\p{N}._()\- ]/gu, '_').slice(0, 160); const extension = path.extname(originalName).toLowerCase();
      if (!file || !originalName || !IMPORTABLE_EXTENSIONS.has(extension)) return sendError(res, 400, 'HWP, HWPX, PDF, XLSX, CSV, TXT 파일만 올릴 수 있습니다.');
      if (!file.buffer.length || file.buffer.length > MAX_IMPORT_BYTES) return sendError(res, 400, '비어 있거나 10MB를 넘는 파일은 올릴 수 없습니다.');
      const importId = id('import'); const storedName = `${importId}${extension}`; fs.mkdirSync(importRoot, { recursive: true }); fs.writeFileSync(path.join(importRoot, storedName), file.buffer, { flag: 'wx' });
      const extraction = extractImport({ ...file, filename: originalName }, data, tenantId); const imported = {
        id: importId, tenantId, status: 'reviewing', source: { originalName, storedName, extension, byteSize: file.buffer.length, sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'), uploadedAt: now(), retentionUntil: new Date(Date.now() + IMPORT_REVIEW_DAYS * 86400000).toISOString() },
        parser: extraction.parser, notes: extraction.notes, review: { organizationProfile: extraction.organizationProfile, members: extraction.members, rowCount: extraction.rowCount, reviewedAt: null, reviewedBy: null }, extractedTextPreview: extraction.extractedTextPreview, createdBy: actor.id, createdAt: now(), updatedAt: now(), appliedAt: null, appliedBy: null,
      };
      data.imports.unshift(imported); audit(data, actor, 'committee_source_uploaded', imported.id, { tenantId, extension, byteSize: file.buffer.length, parser: imported.parser, candidateMembers: imported.review.members.length });
      const chair = data.users.find((user) => user.tenantId === tenantId && user.role === 'chair' && user.active); if (chair && chair.id !== actor.id) pushNotification(data, { userId: chair.id, tenantId, kind: 'import_review', title: '위원회 자료 검토가 필요합니다', body: `${originalName}에서 추출한 기구 정보·명단 초안을 확인해 주세요.` });
      store.write(data); return json(res, 201, { id: imported.id, status: imported.status, parser: imported.parser, notes: imported.notes, candidates: { organizationProfile: imported.review.organizationProfile, memberCount: imported.review.members.length } });
    }
    const importMatch = pathname.match(/^\/api\/imports\/([^/]+)$/);
    if (importMatch) {
      const imported = data.imports.find((entry) => entry.id === importMatch[1]); if (!imported || !canReviewImports(actor, imported.tenantId)) return sendError(res, 404, '검토할 자료를 찾을 수 없습니다.');
      if (req.method === 'PATCH') {
        if (imported.status !== 'reviewing') return sendError(res, 409, '이미 반영하거나 폐기한 자료는 수정할 수 없습니다. 새 검토본을 올려 주세요.');
        const body = await parseBody(req); if (body.organizationProfile && typeof body.organizationProfile === 'object') imported.review.organizationProfile = cleanImportProfile({ ...imported.review.organizationProfile, ...body.organizationProfile });
        if (Array.isArray(body.members)) imported.review.members = body.members.slice(0, 500).map(cleanImportMember).filter((member) => member.name);
        imported.review.reviewedAt = now(); imported.review.reviewedBy = actor.id; imported.updatedAt = now(); audit(data, actor, 'committee_source_review_updated', imported.id, { memberCount: imported.review.members.length }); store.write(data); return json(res, 200, imported);
      }
      if (req.method === 'DELETE') {
        if (imported.status === 'applied') return sendError(res, 409, '반영을 마친 자료는 인수인계 기록을 위해 이 화면에서 삭제할 수 없습니다.');
        const stored = importFilePath(imported.source.storedName); if (stored && fs.existsSync(stored)) fs.unlinkSync(stored);
        imported.status = 'discarded'; imported.review.members = []; imported.extractedTextPreview = ''; imported.updatedAt = now(); audit(data, actor, 'committee_source_discarded', imported.id); store.write(data); return json(res, 200, { id: imported.id, status: imported.status });
      }
    }
    const importApplyMatch = pathname.match(/^\/api\/imports\/([^/]+)\/apply$/);
    if (req.method === 'POST' && importApplyMatch) {
      const imported = data.imports.find((entry) => entry.id === importApplyMatch[1]); if (!imported || !canReviewImports(actor, imported.tenantId)) return sendError(res, 404, '반영할 자료를 찾을 수 없습니다.');
      if (imported.status !== 'reviewing') return sendError(res, 409, '이미 반영하거나 폐기한 자료입니다.');
      const targetTenant = data.tenants.find((tenant) => tenant.id === imported.tenantId); const included = imported.review.members.filter((member) => member.included && member.name);
      const additions = included.filter((member) => !data.users.some((user) => user.tenantId === imported.tenantId && ((member.existingUserId && user.id === member.existingUserId) || (member.email && String(user.email || '').toLowerCase() === member.email.toLowerCase())))); const reserved = data.users.filter((user) => user.tenantId === imported.tenantId && user.role !== 'platform_admin' && (user.active || user.invitationStatus === 'imported_pending_invitation')).length + data.invitations.filter((entry) => entry.tenantId === imported.tenantId && ['sent', 'pending_approval'].includes(entry.status)).length;
      if (reserved + additions.length > targetTenant.capacity) return sendError(res, 409, `정원 ${targetTenant.capacity}명 중 ${reserved}명이 이미 사용 중입니다. 반영할 명단 행을 줄이거나 정원을 먼저 조정해 주세요.`);
      const profile = ensureOrganizationProfile(targetTenant); for (const key of ORGANIZATION_PROFILE_FIELDS) if (imported.review.organizationProfile[key]) profile[key] = imported.review.organizationProfile[key];
      const outcomes = [];
      for (const candidate of included) {
        const existing = candidate.existingUserId ? data.users.find((user) => user.id === candidate.existingUserId && user.tenantId === imported.tenantId) : candidate.email ? data.users.find((user) => user.tenantId === imported.tenantId && String(user.email || '').toLowerCase() === candidate.email.toLowerCase()) : null;
        if (existing) { Object.assign(existing, { name: candidate.name, role: candidate.role, term: candidate.term || existing.term, ageBand: candidate.ageBand || existing.ageBand, job: candidate.job || existing.job, region: candidate.region || existing.region, importedFrom: imported.id, updatedAt: now() }); outcomes.push({ memberId: existing.id, action: 'updated' }); }
        else { const member = { id: id('user'), name: candidate.name, email: candidate.email, role: candidate.role, tenantId: imported.tenantId, active: false, term: candidate.term || targetTenant.cohort, ageBand: candidate.ageBand || '응답하지 않음', job: candidate.job, region: candidate.region, orgNodeId: null, orgAssignments: [], passwordSalt: '', passwordHash: '', invitationStatus: 'imported_pending_invitation', importedFrom: imported.id, importedAt: now() }; data.users.push(member); outcomes.push({ memberId: member.id, action: 'added' }); }
      }
      imported.status = 'applied'; imported.appliedAt = now(); imported.appliedBy = actor.id; imported.updatedAt = now(); imported.appliedMembers = outcomes; targetTenant.updatedAt = now(); audit(data, actor, 'committee_source_applied', imported.id, { tenantId: imported.tenantId, profileFields: Object.keys(imported.review.organizationProfile).filter((key) => imported.review.organizationProfile[key]), membersAdded: outcomes.filter((item) => item.action === 'added').length, membersUpdated: outcomes.filter((item) => item.action === 'updated').length }); store.write(data); return json(res, 200, { id: imported.id, status: imported.status, outcomes });
    }
    if (req.method === 'GET' && pathname === '/api/admin/overview') {
      if (!requirePlatformAdmin(actor, res)) return;
      const platform = platformData(data);
      return json(res, 200, {
        ...platform,
        tenants: data.tenants,
        userCount: data.users.filter((entry) => entry.active).length,
        meetingCount: data.meetings.length,
        proposalCount: data.proposals.length,
        supportSignals: [
          ...data.tenants.filter((entry) => !entry.active).map((entry) => ({ kind: 'suspended_tenant', tenantId: entry.id, label: `${entry.name} 공간이 중지됨` })),
          ...platform.consultationAssignments.filter((entry) => entry.status === 'awaiting_assignment').map((entry) => ({ kind: 'unassigned_consultation', proposalId: entry.proposalId, label: '검토자 미배정 컨설팅 요청' })),
          ...platform.researchRequests.filter((entry) => entry.status === 'approval_pending').map((entry) => ({ kind: 'research_approval', requestId: entry.id, label: '연구·데이터 요청 승인 대기' })),
          ...platform.pilotRequests.filter((entry) => entry.status === 'received').map((entry) => ({ kind: 'pilot_request', requestId: entry.id, label: `${entry.organizationName} 도입 문의 접수` })),
        ],
      });
    }
    if (req.method === 'POST' && pathname === '/api/admin/tenants') {
      if (!requirePlatformAdmin(actor, res)) return;
      const body = await parseBody(req);
      const name = String(body.name || '').trim(); const cohort = String(body.cohort || '').trim(); const capacity = Number(body.capacity);
      if (!name || !cohort || !Number.isInteger(capacity) || capacity < 1 || capacity > 10000) return sendError(res, 400, '기구명, 기수, 1~10,000명 사이의 정원을 입력해 주세요.');
      const template = (data.tenantTemplates || []).find((entry) => entry.id === body.templateId) || (data.tenantTemplates || [])[0];
      const created = {
        id: id('tenant'), name: name.slice(0, 160), cohort: cohort.slice(0, 80), capacity, active: body.active !== false && body.active !== 'false', operator: String(body.operator || actor.name).slice(0, 80),
        templateId: template?.id || null,
        featureFlags: { community: true, aiAssistant: true, researchExport: false, ...(body.featureFlags || {}) },
        serviceAccess: { plan: 'template_experience', status: 'proposal_pending', dataMode: 'template_only', seatLimit: capacity, supportLevel: 'none' },
        settings: { ageBands: template?.ageBands || ['20–24', '25–29', '30–34', '35–39', '응답하지 않음'], divisions: template?.divisions || ['자유 의제'], managerName: String(body.managerName || '').slice(0, 80), organizationProfile: { displayName: name.slice(0, 160), institutionName: String(body.institutionName || '').trim().slice(0, 200), institutionType: INSTITUTION_TYPES.has(body.institutionType) ? body.institutionType : '기초 지자체' } },
        createdAt: now(), updatedAt: now(),
      };
      ensureOrganizationProfile(created); ensureOrgChart(created); normalizeServiceAccess(created); data.tenants.unshift(created); audit(data, actor, 'tenant_created', created.id, { capacity, templateId: created.templateId, accessPlan: created.serviceAccess.plan }); store.write(data); return json(res, 201, created);
    }
    const adminTenantMatch = pathname.match(/^\/api\/admin\/tenants\/([^/]+)$/);
    if (req.method === 'PATCH' && adminTenantMatch) {
      if (!requirePlatformAdmin(actor, res)) return;
      const tenant = data.tenants.find((entry) => entry.id === adminTenantMatch[1]); if (!tenant) return sendError(res, 404, '테넌트를 찾을 수 없습니다.');
      const body = await parseBody(req);
      if (typeof body.active === 'boolean') tenant.active = body.active;
      if (Number.isInteger(body.capacity) && body.capacity > 0 && body.capacity < 10001) tenant.capacity = body.capacity;
      if (body.templateId && (data.tenantTemplates || []).some((entry) => entry.id === body.templateId)) tenant.templateId = body.templateId;
      if (body.featureFlags && typeof body.featureFlags === 'object') tenant.featureFlags = { ...tenant.featureFlags, ...body.featureFlags };
      if (body.settings && typeof body.settings === 'object') tenant.settings = { ...(tenant.settings || {}), ...body.settings };
      if (body.serviceAccess && typeof body.serviceAccess === 'object') tenant.serviceAccess = { ...(tenant.serviceAccess || {}), ...body.serviceAccess };
      normalizeServiceAccess(tenant);
      tenant.updatedAt = now(); audit(data, actor, 'tenant_settings_updated', tenant.id, { active: tenant.active, capacity: tenant.capacity, templateId: tenant.templateId, accessPlan: tenant.serviceAccess.plan, accessStatus: tenant.serviceAccess.status }); store.write(data); return json(res, 200, tenant);
    }
    if (req.method === 'POST' && pathname === '/api/admin/research-requests') {
      if (!requirePlatformAdmin(actor, res)) return;
      const body = await parseBody(req); const title = String(body.title || '').trim(); const purpose = String(body.purpose || '').trim();
      if (!title || !purpose) return sendError(res, 400, '연구 목적과 요청 제목을 입력해 주세요.');
      const request = { id: id('research'), title: title.slice(0, 200), purpose: purpose.slice(0, 2000), variables: Array.isArray(body.variables) ? body.variables.slice(0, 20) : [], status: 'approval_pending', requestedBy: actor.id, approverId: null, expiresAt: body.expiresAt || null, createdAt: now() };
      data.researchRequests = data.researchRequests || []; data.researchRequests.unshift(request); audit(data, actor, 'research_request_created', request.id, { variables: request.variables }); store.write(data); return json(res, 201, request);
    }
    const pilotRequestMatch = pathname.match(/^\/api\/admin\/pilot-requests\/([^/]+)$/);
    if (req.method === 'PATCH' && pilotRequestMatch) {
      if (!requirePlatformAdmin(actor, res)) return;
      const request = (data.pilotRequests || []).find((entry) => entry.id === pilotRequestMatch[1]); if (!request) return sendError(res, 404, '도입 문의를 찾을 수 없습니다.');
      const body = await parseBody(req); const status = String(body.status || '');
      if (!['received', 'reviewing', 'contacted', 'closed'].includes(status)) return sendError(res, 400, '접수 상태를 확인해 주세요.');
      request.status = status; request.updatedAt = now(); audit(data, actor, 'pilot_request_status_updated', request.id, { status }); store.write(data); return json(res, 200, request);
    }
    if (req.method === 'GET' && pathname === '/api/export') {
      audit(data, actor, 'export_requested', 'tenant_data'); store.write(data);
      return json(res, 200, { exportedAt: now(), notice: '합성 데모 데이터입니다. 실제 연구·외부 제출에는 별도 승인과 비식별 검토가 필요합니다.', data: publicData(data, actor) });
    }
    if (req.method === 'POST' && pathname === '/api/deletion-requests') {
      const body = await parseBody(req);
      const request = { id: id('deletion'), tenantId: actor.tenantId, requestedBy: actor.id, scope: body.scope || '내 계정 정보', reason: body.reason || '', status: 'requested', createdAt: now() };
      data.deletionRequests.unshift(request); audit(data, actor, 'deletion_requested', 'personal_data', { scope: request.scope }); store.write(data);
      return json(res, 201, request);
    }
    if (req.method === 'POST' && pathname === '/api/meetings') {
      if (!MUTATORS.has(actor.role)) return sendError(res, 403, '회의를 만들 권한이 없습니다.');
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId);
      if (!tenantId || !canManageTenant(actor, tenantId)) return sendError(res, 403, '대상 위원회의 관리 권한이 없습니다.');
      const agenda = String(body.agendaText || body.agendaTitle || '').split('\n').map((title) => title.trim()).filter(Boolean).slice(0, 20).map((title) => ({ id: id('agenda'), title: title.slice(0, 200), issueId: body.issueId || null, status: 'planned' }));
      const participantIds = Array.isArray(body.participantIds) ? body.participantIds.filter((userId) => data.users.some((user) => user.id === userId && user.tenantId === tenantId && user.active)).slice(0, tenant.capacity) : data.users.filter((user) => user.tenantId === tenantId && user.active && user.role !== 'platform_admin').map((user) => user.id);
      const materials = String(body.materialText || '').split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 20).map((label) => ({ id: id('material'), label: label.slice(0, 240), url: /^https:\/\//i.test(label) ? label.slice(0, 1000) : '' }));
      const meeting = { id: id('meeting'), tenantId, title: body.title?.trim() || '새 회의', type: body.type || '정기회의', startsAt: body.startsAt || '', location: body.location || '', agenda, materials, minutes: '', decisions: [], participantIds, rsvp: {}, attendance: {}, status: 'scheduled', createdBy: actor.id, createdAt: now(), updatedAt: now() };
      data.meetings.unshift(meeting); audit(data, actor, 'meeting_created', meeting.id, { tenantId }); store.write(data); return json(res, 201, meeting);
    }
    const meetingMatch = pathname.match(/^\/api\/meetings\/([^/]+)$/);
    if (req.method === 'PATCH' && meetingMatch) {
      const meeting = data.meetings.find((entry) => entry.id === meetingMatch[1]); if (!meeting || !canManageTenant(actor, meeting.tenantId)) return sendError(res, 403, '회의를 수정할 권한이 없습니다.');
      const body = await parseBody(req); ensureMeetingModel(meeting, data);
      if (body.title?.trim()) meeting.title = String(body.title).trim().slice(0, 200); if (body.type?.trim()) meeting.type = String(body.type).trim().slice(0, 60); if (typeof body.startsAt === 'string') meeting.startsAt = body.startsAt; if (typeof body.location === 'string') meeting.location = body.location.slice(0, 240); if (['scheduled', 'cancelled', 'completed'].includes(body.status)) meeting.status = body.status;
      if (typeof body.agendaText === 'string') meeting.agenda = body.agendaText.split('\n').map((title) => title.trim()).filter(Boolean).slice(0, 20).map((title) => ({ id: id('agenda'), title: title.slice(0, 200), status: 'planned' }));
      if (typeof body.materialText === 'string') meeting.materials = body.materialText.split('\n').map((label) => label.trim()).filter(Boolean).slice(0, 20).map((label) => ({ id: id('material'), label: label.slice(0, 240), url: /^https:\/\//i.test(label) ? label.slice(0, 1000) : '' }));
      if (Array.isArray(body.participantIds)) meeting.participantIds = body.participantIds.filter((userId) => data.users.some((user) => user.id === userId && user.tenantId === meeting.tenantId && user.active)).slice(0, 10000);
      meeting.updatedAt = now(); audit(data, actor, 'meeting_updated', meeting.id); store.write(data); return json(res, 200, meeting);
    }
    if (req.method === 'DELETE' && meetingMatch) {
      const meeting = data.meetings.find((entry) => entry.id === meetingMatch[1]); if (!meeting || !canManageTenant(actor, meeting.tenantId)) return sendError(res, 403, '회의를 삭제할 권한이 없습니다.');
      data.meetings = data.meetings.filter((entry) => entry.id !== meeting.id); audit(data, actor, 'meeting_deleted', meeting.id); store.write(data); return json(res, 200, { deletedId: meeting.id });
    }
    const attendanceMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/attendance$/);
    if (req.method === 'PATCH' && attendanceMatch) {
      const meeting = data.meetings.find((entry) => entry.id === attendanceMatch[1]); if (!meeting || !canSeeTenant(actor, meeting.tenantId)) return sendError(res, 404, '회의를 찾을 수 없습니다.');
      const { status } = await parseBody(req); const allowed = ['attending', 'absent', 'undecided']; if (!allowed.includes(status)) return sendError(res, 400, '허용되지 않는 참석 상태입니다.');
      ensureMeetingModel(meeting, data); if (!meeting.participantIds.includes(actor.id)) return sendError(res, 403, '이 회의의 참석 대상자가 아닙니다.');
      meeting.rsvp[actor.id] = status; audit(data, actor, 'rsvp_updated', meeting.id, { status }); store.write(data); return json(res, 200, meeting);
    }
    const managedAttendanceMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/attendance\/([^/]+)$/);
    if (req.method === 'PATCH' && managedAttendanceMatch) {
      const meeting = data.meetings.find((entry) => entry.id === managedAttendanceMatch[1]);
      if (!meeting || !canManageTenant(actor, meeting.tenantId)) return sendError(res, 403, '참석 현황을 관리할 권한이 없습니다.');
      const attendee = data.users.find((entry) => entry.id === managedAttendanceMatch[2] && entry.tenantId === meeting.tenantId && entry.active);
      const { status } = await parseBody(req); const allowed = ['attending', 'absent', 'undecided'];
      if (!attendee || !allowed.includes(status)) return sendError(res, 400, '구성원 또는 참석 상태를 확인해 주세요.');
      ensureMeetingModel(meeting, data); if (!meeting.participantIds.includes(attendee.id)) return sendError(res, 400, '이 회의의 참석 대상자가 아닙니다.');
      meeting.attendance[attendee.id] = status; audit(data, actor, 'attendance_managed', meeting.id, { attendeeId: attendee.id, status }); store.write(data); return json(res, 200, meeting);
    }
    const minutesMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/minutes$/);
    if (req.method === 'PATCH' && minutesMatch) {
      const meeting = data.meetings.find((entry) => entry.id === minutesMatch[1]); if (!meeting || !canManageTenant(actor, meeting.tenantId)) return sendError(res, 403, '회의록을 수정할 권한이 없습니다.');
      const { minutes } = await parseBody(req); meeting.minutes = String(minutes || '').slice(0, 12000); audit(data, actor, 'minutes_updated', meeting.id); store.write(data); return json(res, 200, meeting);
    }
    const decisionMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/decisions$/);
    if (req.method === 'POST' && decisionMatch) {
      const meeting = data.meetings.find((entry) => entry.id === decisionMatch[1]); if (!meeting || !canManageTenant(actor, meeting.tenantId)) return sendError(res, 403, '결정사항을 추가할 권한이 없습니다.');
      const body = await parseBody(req); if (!body.text?.trim()) return sendError(res, 400, '결정 내용을 입력해 주세요.');
      const owner = data.users.find((entry) => entry.id === body.ownerId && entry.tenantId === meeting.tenantId);
      const decision = { id: id('decision'), text: String(body.text).slice(0, 1000), ownerId: owner?.id || actor.id, dueAt: body.dueAt || '', status: 'open' };
      meeting.decisions.push(decision); audit(data, actor, 'decision_created', meeting.id, { decisionId: decision.id }); store.write(data); return json(res, 201, decision);
    }
    const decisionItemMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/decisions\/([^/]+)$/);
    if (req.method === 'PATCH' && decisionItemMatch) {
      const meeting = data.meetings.find((entry) => entry.id === decisionItemMatch[1]); if (!meeting || !canManageTenant(actor, meeting.tenantId)) return sendError(res, 403, '결정·과제를 수정할 권한이 없습니다.');
      const decision = meeting.decisions.find((entry) => entry.id === decisionItemMatch[2]); if (!decision) return sendError(res, 404, '결정·과제를 찾을 수 없습니다.'); const body = await parseBody(req);
      if (body.text?.trim()) decision.text = String(body.text).trim().slice(0, 1000); if (body.ownerId && data.users.some((user) => user.id === body.ownerId && user.tenantId === meeting.tenantId && user.active)) decision.ownerId = body.ownerId; if (typeof body.dueAt === 'string') decision.dueAt = body.dueAt; if (['open', 'completed'].includes(body.status)) decision.status = body.status;
      audit(data, actor, 'decision_updated', meeting.id, { decisionId: decision.id, status: decision.status }); store.write(data); return json(res, 200, decision);
    }
    if (req.method === 'DELETE' && decisionItemMatch) {
      const meeting = data.meetings.find((entry) => entry.id === decisionItemMatch[1]); if (!meeting || !canManageTenant(actor, meeting.tenantId)) return sendError(res, 403, '결정·과제를 삭제할 권한이 없습니다.');
      const exists = meeting.decisions.some((entry) => entry.id === decisionItemMatch[2]); if (!exists) return sendError(res, 404, '결정·과제를 찾을 수 없습니다.'); meeting.decisions = meeting.decisions.filter((entry) => entry.id !== decisionItemMatch[2]); audit(data, actor, 'decision_deleted', meeting.id, { decisionId: decisionItemMatch[2] }); store.write(data); return json(res, 200, { deletedId: decisionItemMatch[2] });
    }
    if (req.method === 'GET' && pathname === '/api/invitations') {
      const tenantId = tenantFor(actor, url.searchParams.get('tenantId')); if (!tenantId || !canManageTenant(actor, tenantId)) return sendError(res, 403, '초대 현황을 볼 권한이 없습니다.');
      return json(res, 200, data.invitations.filter((entry) => entry.tenantId === tenantId));
    }
    if (req.method === 'POST' && pathname === '/api/invitations') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); const tenant = data.tenants.find((entry) => entry.id === tenantId);
      if (!tenant || !canManageTenant(actor, tenantId)) return sendError(res, 403, '구성원을 초대할 권한이 없습니다.');
      const handoverPlan = body.handoverPlanId ? data.handoverPlans.find((entry) => entry.id === body.handoverPlanId && entry.tenantId === tenantId && entry.status === 'planned') : null;
      if (body.handoverPlanId && !handoverPlan) return sendError(res, 400, '진행 중인 기수 인계 계획을 선택해 주세요.');
      const email = String(body.email || '').trim().toLowerCase(); const role = TENANT_ROLES.includes(body.role) ? body.role : 'member';
      if (!email.includes('@')) return sendError(res, 400, '초대할 이메일을 입력해 주세요.');
      if (data.users.some((entry) => entry.email === email) || data.invitations.some((entry) => entry.tenantId === tenantId && entry.email === email && ['sent', 'pending_approval'].includes(entry.status))) return sendError(res, 409, '이미 가입했거나 진행 중인 초대입니다.');
      const occupied = data.users.filter((entry) => entry.tenantId === tenantId && entry.active).length + data.invitations.filter((entry) => entry.tenantId === tenantId && ['sent', 'pending_approval'].includes(entry.status)).length;
      if (occupied >= tenant.capacity) return sendError(res, 409, `정원 ${tenant.capacity}명에 도달했습니다.`);
      const invitation = { id: id('invite'), token: crypto.randomBytes(24).toString('base64url'), tenantId, email, role, term: String(body.term || handoverPlan?.targetCohort || tenant.cohort || '').slice(0, 80), messageExtra: String(body.messageExtra || '').trim().slice(0, 700), handoverPlanId: handoverPlan?.id || null, status: 'sent', createdBy: actor.id, createdAt: now(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(), applicantUserId: null, shareAttempts: [] };
      data.invitations.unshift(invitation); audit(data, actor, 'invitation_created', invitation.id, { tenantId, role }); store.write(data);
      const invitationUrl = `/join/${invitation.token}`;
      return json(res, 201, { ...invitation, invitationUrl, invitationCopy: buildInvitationCopy(tenant, invitation, invitationUrl), notice: '링크와 안내 문구를 복사하거나 기본 메일 앱에서 보낼 수 있습니다. 실제 발송 결과 추적은 연결하지 않았습니다.' });
    }
    const invitationMatch = pathname.match(/^\/api\/invitations\/([^/]+)$/);
    const invitationShareMatch = pathname.match(/^\/api\/invitations\/([^/]+)\/share$/);
    if (req.method === 'POST' && invitationShareMatch) {
      const invitation = data.invitations.find((entry) => entry.id === invitationShareMatch[1]); if (!invitation || !canManageTenant(actor, invitation.tenantId)) return sendError(res, 403, '초대 문구를 공유할 권한이 없습니다.');
      const body = await parseBody(req); const channel = ['copy', 'mailto', 'webshare'].includes(body.channel) ? body.channel : 'copy';
      invitation.shareAttempts ||= []; invitation.shareAttempts.unshift({ channel, at: now(), by: actor.id }); invitation.shareAttempts = invitation.shareAttempts.slice(0, 20);
      const tenant = data.tenants.find((entry) => entry.id === invitation.tenantId); audit(data, actor, 'invitation_share_prepared', invitation.id, { channel }); store.write(data);
      return json(res, 200, { invitationUrl: `/join/${invitation.token}`, invitationCopy: buildInvitationCopy(tenant, invitation, `/join/${invitation.token}`), notice: '공유 준비 기록만 남겼습니다. 실제 메일·메신저 발송 여부는 이 MVP에서 추적하지 않습니다.' });
    }
    if (req.method === 'PATCH' && invitationMatch) {
      const invitation = data.invitations.find((entry) => entry.id === invitationMatch[1]); if (!invitation || !canManageTenant(actor, invitation.tenantId)) return sendError(res, 403, '초대 상태를 변경할 권한이 없습니다.');
      const body = await parseBody(req); const allowed = ['approved', 'rejected', 'revoked']; if (!allowed.includes(body.status)) return sendError(res, 400, '변경할 초대 상태를 선택해 주세요.');
      const applicant = data.users.find((entry) => entry.id === invitation.applicantUserId);
      if (body.status === 'approved') { if (!applicant) return sendError(res, 409, '아직 가입 정보를 제출하지 않았습니다.'); applicant.active = true; applicant.invitationStatus = 'approved'; invitation.approvedAt = now(); }
      if (body.status === 'rejected' && applicant) { applicant.active = false; applicant.invitationStatus = 'rejected'; }
      invitation.status = body.status; audit(data, actor, `invitation_${body.status}`, invitation.id, { applicantUserId: invitation.applicantUserId || null }); store.write(data); return json(res, 200, invitation);
    }
    if (req.method === 'POST' && pathname === '/api/handover-plans') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); const tenant = data.tenants.find((entry) => entry.id === tenantId);
      if (!tenant || !canManageTenant(actor, tenantId)) return sendError(res, 403, '기수 인계 계획을 만들 권한이 없습니다.');
      const targetCohort = String(body.targetCohort || '').trim(); if (!targetCohort) return sendError(res, 400, '다음 기수 또는 대수 명칭을 입력해 주세요.');
      const archiveItemIds = Array.isArray(body.archiveItemIds) ? body.archiveItemIds.filter((itemId) => data.archiveItems.some((item) => item.id === itemId && item.tenantId === tenantId)).slice(0, 100) : [];
      const incomingAssignments = Array.isArray(body.incomingAssignments) ? body.incomingAssignments.filter((item) => TENANT_ROLES.includes(item?.role) && data.users.some((user) => user.id === item?.userId && user.tenantId === tenantId && user.active)).slice(0, 20).map((item) => ({ userId: item.userId, role: item.role })) : [];
      const reportSnapshot = buildActivityReport(data, tenantId, { periodStart: body.periodStart, periodEnd: body.periodEnd });
      const plan = { id: id('handover'), tenantId, sourceCohort: tenant.cohort, targetCohort: targetCohort.slice(0, 80), summary: String(body.summary || '').trim().slice(0, 3000), priorityItems: String(body.priorityItems || '').trim().slice(0, 3000), archiveItemIds, incomingAssignments, reportSnapshot, status: 'planned', createdBy: actor.id, createdAt: now(), completedAt: null, archivePackageId: null };
      data.handoverPlans.unshift(plan); audit(data, actor, 'handover_plan_created', plan.id, { sourceCohort: plan.sourceCohort, targetCohort: plan.targetCohort }); store.write(data); return json(res, 201, plan);
    }
    const handoverPlanMatch = pathname.match(/^\/api\/handover-plans\/([^/]+)$/);
    if (req.method === 'PATCH' && handoverPlanMatch) {
      const plan = data.handoverPlans.find((entry) => entry.id === handoverPlanMatch[1]); if (!plan || !canManageTenant(actor, plan.tenantId)) return sendError(res, 403, '기수 인계 계획을 수정할 권한이 없습니다.');
      if (plan.status !== 'planned') return sendError(res, 409, '완료된 인계 계획은 수정할 수 없습니다.');
      const body = await parseBody(req);
      if (body.targetCohort?.trim()) plan.targetCohort = String(body.targetCohort).trim().slice(0, 80);
      if (typeof body.summary === 'string') plan.summary = body.summary.trim().slice(0, 3000);
      if (typeof body.priorityItems === 'string') plan.priorityItems = body.priorityItems.trim().slice(0, 3000);
      if (Array.isArray(body.archiveItemIds)) plan.archiveItemIds = body.archiveItemIds.filter((itemId) => data.archiveItems.some((item) => item.id === itemId && item.tenantId === plan.tenantId)).slice(0, 100);
      if (Array.isArray(body.incomingAssignments)) plan.incomingAssignments = body.incomingAssignments.filter((item) => TENANT_ROLES.includes(item?.role) && data.users.some((user) => user.id === item?.userId && user.tenantId === plan.tenantId && user.active)).slice(0, 20).map((item) => ({ userId: item.userId, role: item.role }));
      audit(data, actor, 'handover_plan_updated', plan.id, { targetCohort: plan.targetCohort, assignmentCount: plan.incomingAssignments.length }); store.write(data); return json(res, 200, plan);
    }
    const handoverCompleteMatch = pathname.match(/^\/api\/handover-plans\/([^/]+)\/complete$/);
    if (req.method === 'POST' && handoverCompleteMatch) {
      const plan = data.handoverPlans.find((entry) => entry.id === handoverCompleteMatch[1]); if (!plan || !canManageTenant(actor, plan.tenantId)) return sendError(res, 403, '기수 인계 권한이 없습니다.');
      if (plan.status !== 'planned') return sendError(res, 409, '이미 완료되었거나 취소된 인계 계획입니다.');
      const tenant = data.tenants.find((entry) => entry.id === plan.tenantId);
      const incoming = plan.incomingAssignments.map((assignment) => ({ ...assignment, user: data.users.find((user) => user.id === assignment.userId && user.tenantId === plan.tenantId && user.active) })).filter((assignment) => assignment.user);
      if (!incoming.some((assignment) => assignment.role === 'chair')) return sendError(res, 409, '권한을 넘길 다음 기수 위원장 1명을 지정하고, 가입 승인을 완료해 주세요.');
      const incomingIds = new Set(incoming.map((assignment) => assignment.userId));
      for (const outgoing of data.users.filter((user) => user.tenantId === plan.tenantId && user.active && ['chair', 'vice_chair', 'secretary'].includes(user.role) && !incomingIds.has(user.id))) { outgoing.role = 'member'; outgoing.term = plan.sourceCohort; outgoing.handoverDemotedAt = now(); }
      for (const assignment of incoming) { assignment.user.role = assignment.role; assignment.user.term = plan.targetCohort; assignment.user.handoverAssignedAt = now(); }
      tenant.cohort = plan.targetCohort; ensureOrganizationProfile(tenant).termLabel = plan.targetCohort; tenant.settings ||= {}; tenant.settings.cohortHistory ||= []; tenant.settings.cohortHistory.unshift({ from: plan.sourceCohort, to: plan.targetCohort, handoverPlanId: plan.id, completedAt: now(), completedBy: actor.id }); tenant.updatedAt = now();
      const packageItem = { id: id('archive'), tenantId: plan.tenantId, title: `${plan.sourceCohort} → ${plan.targetCohort} 인수인계 패키지`, category: '인수인계', body: `${plan.summary || '운영 인계 요약'}\n\n우선 확인할 항목\n${plan.priorityItems || '추가 확인 항목을 입력해 주세요.'}\n\n자동 집계 스냅샷\n회의 ${plan.reportSnapshot.metrics.meetingCount}건 · 결정 완료 ${plan.reportSnapshot.metrics.completedDecisionCount}/${plan.reportSnapshot.metrics.decisionCount}건 · 제출 제안 ${plan.reportSnapshot.metrics.submittedProposalCount}건 · 아카이브 ${plan.reportSnapshot.metrics.archiveCount}건`, sourceUrl: '', visibility: 'tenant', createdBy: actor.id, createdAt: now(), handoverPlanId: plan.id, includedArchiveItemIds: plan.archiveItemIds };
      data.archiveItems.unshift(packageItem); plan.status = 'completed'; plan.completedAt = now(); plan.completedBy = actor.id; plan.archivePackageId = packageItem.id;
      audit(data, actor, 'handover_completed', plan.id, { sourceCohort: plan.sourceCohort, targetCohort: plan.targetCohort, incomingAssignments: incoming.map(({ userId, role }) => ({ userId, role })) }); store.write(data); return json(res, 200, { plan, archivePackage: packageItem });
    }
    if (req.method === 'POST' && pathname === '/api/activity-reports') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId);
      if (!tenantId || !canManageTenant(actor, tenantId)) return sendError(res, 403, '성과 리포트를 만들 권한이 없습니다.');
      const report = { id: id('report'), tenantId, title: String(body.title || '참여기구 활동 리포트').trim().slice(0, 160), ...buildActivityReport(data, tenantId, body), status: 'generated', aiReview: null, createdBy: actor.id, createdAt: now() };
      data.activityReports.unshift(report); audit(data, actor, 'activity_report_generated', report.id, { periodStart: report.periodStart, periodEnd: report.periodEnd }); store.write(data); return json(res, 201, report);
    }
    const reportAiMatch = pathname.match(/^\/api\/activity-reports\/([^/]+)\/ai-review$/);
    if (req.method === 'POST' && reportAiMatch) {
      const report = data.activityReports.find((entry) => entry.id === reportAiMatch[1]); if (!report || !canManageTenant(actor, report.tenantId)) return sendError(res, 403, '성과 리포트를 검토할 권한이 없습니다.');
      if (!OPENAI_API_KEY) return sendError(res, 503, 'AI 리포트 검토 API가 아직 연결되지 않았습니다. 서버 환경변수 OPENAI_API_KEY를 설정한 뒤 다시 시도해 주세요.');
      const prompt = `다음은 청년참여기구의 비식별 집계 리포트다. 개인 평가, 서열화, 성과 과장, 법적 판단을 하지 말고 한국어로 작성하라. '확인된 흐름', '기록상 보완이 필요한 지점', '다음 운영 회의에서 정할 질문' 세 제목 아래 각각 2~4개 문장으로 작성한다. 숫자는 제공된 집계값을 벗어나지 말고, 인과관계는 단정하지 말라.\n\n${JSON.stringify({ period: report.periodLabel, metrics: report.metrics, ruleInsights: report.insights, methodology: report.methodology })}`;
      try {
        const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: OPENAI_MODEL, instructions: 'You are an assistant for a youth-governance operations product. Return only the requested Korean report text.', input: prompt, max_output_tokens: 900, store: false }) });
        const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'AI 요청을 처리하지 못했습니다.');
        const text = (payload.output || []).flatMap((item) => item.content || []).filter((item) => item.type === 'output_text').map((item) => item.text || '').join('\n').trim(); if (!text) throw new Error('AI 응답에 표시할 내용이 없습니다.');
        report.aiReview = { status: 'generated', provider: 'OpenAI API', model: OPENAI_MODEL, body: text.slice(0, 12000), generatedAt: now(), generatedBy: actor.id }; audit(data, actor, 'activity_report_ai_reviewed', report.id, { model: OPENAI_MODEL }); store.write(data); return json(res, 200, report);
      } catch (error) { return sendError(res, 502, `AI 리포트 검토를 만들지 못했습니다: ${error.message}`); }
    }
    if (req.method === 'POST' && pathname === '/api/members') {
      if (!MUTATORS.has(actor.role)) return sendError(res, 403, '구성원을 초대할 권한이 없습니다.');
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId);
      if (!tenantId || !canManageTenant(actor, tenantId)) return sendError(res, 403, '대상 위원회의 관리 권한이 없습니다.');
      const tenant = data.tenants.find((entry) => entry.id === tenantId); const used = data.users.filter((entry) => entry.tenantId === tenantId && entry.active).length;
      if (used >= tenant.capacity) return sendError(res, 409, `정원 ${tenant.capacity}명에 도달했습니다.`);
      const email = String(body.email || '').trim().toLowerCase(); if (!body.name?.trim() || !email.includes('@')) return sendError(res, 400, '이름과 유효한 이메일을 입력해 주세요.'); if (data.users.some((entry) => entry.email === email)) return sendError(res, 409, '이미 등록된 이메일입니다.');
      const orgChart = ensureOrgChart(tenant); const role = ['secretary', 'chair', 'vice_chair', 'division_lead', 'member', 'reviewer'].includes(body.role) ? body.role : 'member';
      const orgAssignments = Array.isArray(body.orgAssignments) ? body.orgAssignments.filter((entry) => orgChart.nodes.some((node) => node.id === entry?.nodeId)).slice(0, 8).map((entry) => ({ nodeId: entry.nodeId, position: String(entry.position || tenant.settings.positionLabels[role] || DEFAULT_POSITION_LABELS.member).slice(0, 80) })) : [];
      if (!orgAssignments.length && orgChart.nodes.some((node) => node.id === body.orgNodeId)) orgAssignments.push({ nodeId: body.orgNodeId, position: tenant.settings.positionLabels[role] || DEFAULT_POSITION_LABELS.member });
      const orgNodeId = orgAssignments[0]?.nodeId || null;
      const salt = crypto.randomBytes(12).toString('hex'); const invited = { id: id('user'), name: String(body.name).slice(0, 80), email, role, tenantId, active: true, term: String(body.term || tenant.cohort || '').slice(0, 80), ageBand: body.ageBand || '응답하지 않음', job: String(body.job || '').slice(0, 120), region: String(body.region || '').slice(0, 120), orgNodeId, orgAssignments, passwordSalt: salt, passwordHash: crypto.scryptSync('invite1234', salt, 64).toString('hex'), invitationStatus: 'invited' };
      data.users.push(invited); audit(data, actor, 'member_invited', invited.id, { tenantId, role: invited.role }); store.write(data); return json(res, 201, { user: safeUser(invited), temporaryPassword: 'invite1234', notice: 'MVP는 실제 이메일을 발송하지 않습니다. 실제 도입 시 일회용 초대 링크와 이메일 인증으로 교체해야 합니다.' });
    }
    const memberMatch = pathname.match(/^\/api\/members\/([^/]+)$/);
    if (req.method === 'PATCH' && memberMatch) {
      const member = data.users.find((entry) => entry.id === memberMatch[1]); if (!member || !canManageTenant(actor, member.tenantId)) return sendError(res, 403, '구성원 역할을 변경할 권한이 없습니다.');
      const tenant = data.tenants.find((entry) => entry.id === member.tenantId); const orgChart = ensureOrgChart(tenant);
      const body = await parseBody(req); const beforeOrganization = organizationSnapshot(member);
      if (body.role && ['secretary', 'chair', 'vice_chair', 'division_lead', 'member', 'reviewer'].includes(body.role)) member.role = body.role; if (typeof body.active === 'boolean') member.active = body.active; if (body.term) member.term = String(body.term).slice(0, 80);
      if (Array.isArray(body.orgAssignments)) {
        const invalid = body.orgAssignments.some((entry) => entry?.nodeId && !orgChart.nodes.some((node) => node.id === entry.nodeId));
        if (invalid) return sendError(res, 400, '이 기구의 조직 단위를 선택해 주세요.');
        member.orgAssignments = body.orgAssignments.filter((entry) => entry?.nodeId).slice(0, 8).map((entry) => ({ nodeId: entry.nodeId, position: String(entry.position || tenant.settings.positionLabels[member.role] || DEFAULT_POSITION_LABELS.member).slice(0, 80) }));
        member.orgNodeId = member.orgAssignments[0]?.nodeId || null;
      } else if (typeof body.orgNodeId === 'string') { if (body.orgNodeId && !orgChart.nodes.some((node) => node.id === body.orgNodeId)) return sendError(res, 400, '이 기구의 조직 단위를 선택해 주세요.'); member.orgNodeId = body.orgNodeId || null; member.orgAssignments = member.orgNodeId ? [{ nodeId: member.orgNodeId, position: tenant.settings.positionLabels[member.role] || DEFAULT_POSITION_LABELS.member }] : []; }
      const organizationChange = recordOrganizationChange(tenant, actor, member, beforeOrganization, body.role ? 'role_or_assignment' : 'assignment');
      audit(data, actor, 'member_updated', member.id, { role: member.role, active: member.active, orgNodeId: member.orgNodeId || null, assignmentCount: member.orgAssignments?.length || 0, organizationChangeId: organizationChange?.id || null }); store.write(data); return json(res, 200, safeUser(member));
    }
    const memberOrganizationRevokeMatch = pathname.match(/^\/api\/members\/([^/]+)\/organization-revoke$/);
    if (req.method === 'POST' && memberOrganizationRevokeMatch) {
      const member = data.users.find((entry) => entry.id === memberOrganizationRevokeMatch[1]); if (!member || !canManageTenant(actor, member.tenantId)) return sendError(res, 403, '구성원의 조직 배치나 역할을 회수할 권한이 없습니다.');
      const tenant = data.tenants.find((entry) => entry.id === member.tenantId); ensureOrgChart(tenant);
      const body = await parseBody(req); const scope = String(body.scope || 'assignment'); const beforeOrganization = organizationSnapshot(member);
      if (scope === 'assignment') {
        const nodeId = String(body.nodeId || '');
        if (!nodeId) return sendError(res, 400, '회수할 조직 단위를 선택해 주세요.');
        member.orgAssignments = (member.orgAssignments || []).filter((entry) => entry.nodeId !== nodeId);
        member.orgNodeId = member.orgAssignments[0]?.nodeId || null;
      } else if (scope === 'all_assignments') {
        member.orgAssignments = []; member.orgNodeId = null;
      } else if (scope === 'role') {
        member.role = 'member';
        member.orgAssignments = (member.orgAssignments || []).map((entry) => ({ ...entry, position: tenant.settings.positionLabels.member || DEFAULT_POSITION_LABELS.member }));
        member.orgNodeId = member.orgAssignments[0]?.nodeId || null;
      } else return sendError(res, 400, '회수 방식을 확인해 주세요.');
      const organizationChange = recordOrganizationChange(tenant, actor, member, beforeOrganization, `revoke_${scope}`);
      if (!organizationChange) return sendError(res, 409, '변경할 조직 배치 또는 역할이 없습니다.');
      audit(data, actor, 'member_organization_revoked', member.id, { scope, nodeId: body.nodeId || null, organizationChangeId: organizationChange.id }); store.write(data); return json(res, 200, { user: safeUser(member), change: organizationChange });
    }
    if (req.method === 'PATCH' && pathname === '/api/tenant-governance') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); const tenant = data.tenants.find((entry) => entry.id === tenantId);
      if (!tenant || !canManageTenant(actor, tenantId, 'permissions')) return sendError(res, 403, '역할과 권한을 설정할 권한이 없습니다.');
      ensureTenantGovernanceSettings(tenant);
      if (body.positionLabels && typeof body.positionLabels === 'object') for (const role of Object.keys(DEFAULT_POSITION_LABELS)) if (typeof body.positionLabels[role] === 'string') tenant.settings.positionLabels[role] = body.positionLabels[role].trim().slice(0, 40) || DEFAULT_POSITION_LABELS[role];
      if (body.rolePermissions && typeof body.rolePermissions === 'object') for (const [role, defaults] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) if (body.rolePermissions[role] && typeof body.rolePermissions[role] === 'object') for (const key of Object.keys(defaults)) if (typeof body.rolePermissions[role][key] === 'boolean') tenant.settings.rolePermissions[role][key] = body.rolePermissions[role][key];
      tenant.settings.rolePermissions.chair = { ...tenant.settings.rolePermissions.chair, manage: true, permissions: true, personalData: true, share: true };
      audit(data, actor, 'tenant_governance_updated', tenantId); store.write(data); return json(res, 200, tenant.settings);
    }
    if (req.method === 'PATCH' && pathname === '/api/organization-profile') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); const tenant = data.tenants.find((entry) => entry.id === tenantId);
      if (!tenant || !(actor.role === 'chair' && actor.tenantId === tenantId)) return sendError(res, 403, '위원장만 참여기구 기본 정보를 수정할 수 있습니다.');
      const profile = ensureOrganizationProfile(tenant);
      for (const key of ORGANIZATION_PROFILE_FIELDS) if (typeof body[key] === 'string') profile[key] = body[key].trim().slice(0, key === 'introduction' ? 800 : 200);
      if (!INSTITUTION_TYPES.has(profile.institutionType)) return sendError(res, 400, '기관 구분은 중앙정부, 광역 지자체, 기초 지자체 중에서 선택해 주세요.');
      for (const key of ['logoUrl', 'institutionHomepageUrl', 'youthPolicyUrl', 'participationGuideUrl', 'ordinanceUrl']) if (profile[key] && !/^https:\/\//i.test(profile[key])) return sendError(res, 400, '로고와 바로가기 주소는 HTTPS 주소만 사용할 수 있습니다.');
      if (profile.pressReleaseFeedUrl) {
        try { profile.pressReleaseFeedUrl = await validatePressReleaseFeedUrl(profile.pressReleaseFeedUrl); } catch (error) { return sendError(res, 400, error.message); }
      }
      tenant.updatedAt = now(); audit(data, actor, 'organization_profile_updated', tenantId); store.write(data); return json(res, 200, profile);
    }
    if (req.method === 'POST' && pathname === '/api/press-release-feed/collect') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); const tenant = data.tenants.find((entry) => entry.id === tenantId);
      if (!tenant || !canManageTenant(actor, tenantId)) return sendError(res, 403, '보도자료를 수집할 권한이 없습니다.');
      const result = await collectPressReleaseFeed(data, tenant); audit(data, actor, 'institution_press_release_collected', tenantId, { created: result.created, error: result.error || null }); store.write(data);
      if (!result.configured) return sendError(res, 400, '참여기구 기본 정보에서 공식 보도자료 RSS·Atom 주소를 먼저 등록해 주세요.');
      if (result.error) return sendError(res, 502, `보도자료를 수집하지 못했습니다: ${result.error}`);
      return json(res, 200, result);
    }
    if (req.method === 'POST' && pathname === '/api/org-nodes') {
      if (!MUTATORS.has(actor.role)) return sendError(res, 403, '조직 단위를 만들 권한이 없습니다.');
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId);
      if (!tenantId || !canManageTenant(actor, tenantId)) return sendError(res, 403, '이 기구의 조직도를 관리할 권한이 없습니다.');
      const tenant = data.tenants.find((entry) => entry.id === tenantId); const chart = ensureOrgChart(tenant); const name = String(body.name || '').trim();
      if (!name) return sendError(res, 400, '조직 단위 이름을 입력해 주세요.');
      const parentId = body.parentId || chart.nodes.find((node) => node.parentId === null)?.id;
      if (!chart.nodes.some((node) => node.id === parentId)) return sendError(res, 400, '상위 조직 단위를 선택해 주세요.');
      const node = { id: id('org'), name: name.slice(0, 80), parentId, kind: String(body.kind || '운영 단위').slice(0, 40), createdAt: now() };
      chart.nodes.push(node); chart.updatedAt = now(); audit(data, actor, 'org_node_created', node.id, { tenantId, parentId, kind: node.kind }); store.write(data); return json(res, 201, node);
    }
    const orgNodeMatch = pathname.match(/^\/api\/org-nodes\/([^/]+)$/);
    if (req.method === 'PATCH' && orgNodeMatch) {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); const tenant = data.tenants.find((entry) => entry.id === tenantId); const chart = tenant && ensureOrgChart(tenant); const node = chart?.nodes.find((entry) => entry.id === orgNodeMatch[1]);
      if (!node || !canManageTenant(actor, tenantId)) return sendError(res, 403, '이 조직 단위를 수정할 권한이 없습니다.');
      if (body.name?.trim()) node.name = String(body.name).trim().slice(0, 80); if (body.kind?.trim()) node.kind = String(body.kind).trim().slice(0, 40); if (body.parentId && body.parentId !== node.id && chart.nodes.some((entry) => entry.id === body.parentId)) node.parentId = body.parentId;
      chart.updatedAt = now(); audit(data, actor, 'org_node_updated', node.id, { tenantId }); store.write(data); return json(res, 200, node);
    }
    if (req.method === 'DELETE' && orgNodeMatch) {
      const tenantId = tenantFor(actor, url.searchParams.get('tenantId')); const tenant = data.tenants.find((entry) => entry.id === tenantId); const chart = tenant && ensureOrgChart(tenant); const node = chart?.nodes.find((entry) => entry.id === orgNodeMatch[1]);
      if (!node || !canManageTenant(actor, tenantId)) return sendError(res, 403, '이 조직 단위를 삭제할 권한이 없습니다.');
      if (!node.parentId || chart.nodes.some((entry) => entry.parentId === node.id) || data.users.some((entry) => entry.tenantId === tenantId && (entry.orgNodeId === node.id || (entry.orgAssignments || []).some((assignment) => assignment.nodeId === node.id)))) return sendError(res, 409, '하위 조직 또는 구성원이 있어 삭제할 수 없습니다. 먼저 소속을 옮겨 주세요.');
      chart.nodes = chart.nodes.filter((entry) => entry.id !== node.id); chart.updatedAt = now(); audit(data, actor, 'org_node_deleted', node.id, { tenantId }); store.write(data); return json(res, 200, { deletedId: node.id });
    }
    if (req.method === 'POST' && pathname === '/api/proposal-draft-assist') {
      if (actor.role === 'reviewer') return sendError(res, 403, '외부 검토자는 정책제안 초안을 만들 수 없습니다.');
      if (!OPENAI_API_KEY) return sendError(res, 503, 'AI 작성 도움 API가 아직 연결되지 않았습니다. 서버 환경변수 OPENAI_API_KEY를 설정한 뒤 다시 시도해 주세요.');
      const body = await parseBody(req); const context = cleanText(body.context, 6000); const topic = cleanText(body.topic, 80) || '자유 의제';
      if (!context) return sendError(res, 400, '정리할 문제와 맥락을 입력해 주세요.');
      const prompt = `청년참여기구 위원이 정책제안서 초안을 준비한다. 다음 입력만 사용해 한국어로 작성하라. 확인되지 않은 통계, 법령, 기관 권한은 만들지 말고 반드시 '[확인 필요]'라고 표시한다. 당사자 경험과 해석을 구분하고, 개인을 식별하거나 평가하지 않는다. 아래 다섯 제목을 정확히 사용해 각 2~4문장으로 제안한다: 문제 정의, 근거·당사자 경험, 해결 제안, 실행 방식, 위험·반론.\n\n분야: ${topic}\n입력: ${context}`;
      try {
        const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: OPENAI_MODEL, instructions: 'You assist with youth-governance policy proposals. Return only the requested Korean draft and do not fabricate facts.', input: prompt, max_output_tokens: 1100, store: false }) });
        const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'AI 요청을 처리하지 못했습니다.');
        const draft = (payload.output || []).flatMap((item) => item.content || []).filter((item) => item.type === 'output_text').map((item) => item.text || '').join('\n').trim(); if (!draft) throw new Error('AI 응답에 표시할 내용이 없습니다.');
        audit(data, actor, 'proposal_draft_assist_requested', 'proposal-draft', { tenantId: actor.tenantId, topic, model: OPENAI_MODEL }); store.write(data); return json(res, 200, { draft: draft.slice(0, 12000), model: OPENAI_MODEL, persisted: false });
      } catch (error) { return sendError(res, 502, `AI 작성 제안을 만들지 못했습니다: ${error.message}`); }
    }
    if (req.method === 'POST' && pathname === '/api/proposals') {
      if (actor.role === 'reviewer') return sendError(res, 403, '외부 검토자는 제안서를 새로 만들 수 없습니다.');
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId);
      if (!tenantId || !canSeeTenant(actor, tenantId)) return sendError(res, 403, '대상 위원회에 접근할 수 없습니다.');
      const sectionInput = body.sections && typeof body.sections === 'object' ? body.sections : {};
      const sections = Object.fromEntries(['problem', 'evidence', 'proposal', 'implementation', 'risks'].map((key) => [key, String(sectionInput[key] || '').slice(0, 12000)]));
      const proposal = { id: id('proposal'), tenantId, title: body.title?.trim() || '새 정책제안', topic: body.topic || '자유 의제', dueAt: /^\d{4}-\d{2}-\d{2}$/.test(body.dueAt || '') ? body.dueAt : null, status: 'draft', issueId: body.issueId || null, ownerId: actor.id, contributors: [actor.id], sections, versions: [{ id: id('version'), label: 'v0.1', note: '초안 생성', createdBy: actor.id, createdAt: now() }], feedback: [], consultation: null, finalSubmission: null, progress: [], createdAt: now(), updatedAt: now() };
      data.proposals.unshift(proposal); audit(data, actor, 'proposal_created', proposal.id); store.write(data); return json(res, 201, proposal);
    }
    const deliveryMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/institution-delivery$/);
    if (req.method === 'POST' && deliveryMatch) {
      const proposal = data.proposals.find((entry) => entry.id === deliveryMatch[1]);
      if (!proposal || !proposalVisible(actor, proposal)) return sendError(res, 404, '제안서를 찾을 수 없습니다.');
      if (actor.role === 'reviewer' || !proposalRecipients(proposal).includes(actor.id)) return sendError(res, 403, '작성자 또는 공동 작성자만 기관에 전달할 수 있습니다.');
      const body = await parseBody(req); const message = String(body.message || '').trim().slice(0, 1500);
      if (!message) return sendError(res, 400, '기관에 함께 보낼 메시지를 입력해 주세요.');
      const delivery = ensureProposalCommunication(proposal);
      delivery.status = 'sent'; delivery.message = message; delivery.submittedBy = actor.id; delivery.submittedAt = now(); delivery.receivedBy = null; delivery.receivedAt = null; delivery.response = null;
      proposal.updatedAt = now();
      const recipients = data.users.filter((user) => user.tenantId === proposal.tenantId && user.active && (INSTITUTION_INBOX_ROLES.has(user.role) || user.role === 'platform_admin')).map((user) => user.id).filter((userId) => userId !== actor.id);
      notifyUsers(data, recipients, { tenantId: proposal.tenantId, kind: 'proposal_delivered', title: '청년 활동가가 정책제안을 전달했습니다', body: proposal.title, proposalId: proposal.id });
      audit(data, actor, 'proposal_delivered_to_institution', proposal.id, { tenantId: proposal.tenantId }); store.write(data); return json(res, 201, proposal);
    }
    const institutionReceivedMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/institution-received$/);
    if (req.method === 'POST' && institutionReceivedMatch) {
      const proposal = data.proposals.find((entry) => entry.id === institutionReceivedMatch[1]);
      if (!proposal || !canSeeTenant(actor, proposal.tenantId)) return sendError(res, 404, '제안서를 찾을 수 없습니다.');
      if (!(actor.role === 'platform_admin' || (actor.tenantId === proposal.tenantId && INSTITUTION_INBOX_ROLES.has(actor.role)))) return sendError(res, 403, '기관 수신을 확인할 권한이 없습니다.');
      const delivery = ensureProposalCommunication(proposal);
      if (delivery.status === 'not_sent') return sendError(res, 409, '아직 기관에 전달된 제안이 아닙니다.');
      if (!delivery.receivedAt) { delivery.status = 'received'; delivery.receivedBy = actor.id; delivery.receivedAt = now(); }
      proposal.updatedAt = now();
      notifyUsers(data, proposalRecipients(proposal).filter((userId) => userId !== actor.id), { tenantId: proposal.tenantId, kind: 'proposal_received', title: '기관이 정책제안을 확인했습니다', body: proposal.title, proposalId: proposal.id });
      audit(data, actor, 'institution_delivery_received', proposal.id, { tenantId: proposal.tenantId }); store.write(data); return json(res, 200, proposal);
    }
    const institutionResponseMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/institution-response$/);
    if (req.method === 'POST' && institutionResponseMatch) {
      const proposal = data.proposals.find((entry) => entry.id === institutionResponseMatch[1]);
      if (!proposal || !canSeeTenant(actor, proposal.tenantId)) return sendError(res, 404, '제안서를 찾을 수 없습니다.');
      if (!(actor.role === 'platform_admin' || (actor.tenantId === proposal.tenantId && INSTITUTION_INBOX_ROLES.has(actor.role)))) return sendError(res, 403, '기관 답변을 남길 권한이 없습니다.');
      const body = await parseBody(req); const message = String(body.message || '').trim().slice(0, 3000);
      if (!message) return sendError(res, 400, '청년 활동가에게 보낼 답변을 입력해 주세요.');
      const delivery = ensureProposalCommunication(proposal);
      if (delivery.status === 'not_sent') return sendError(res, 409, '아직 기관에 전달된 제안이 아닙니다.');
      delivery.status = 'responded'; delivery.receivedBy ||= actor.id; delivery.receivedAt ||= now(); delivery.response = { body: message, createdBy: actor.id, createdAt: now() };
      proposal.updatedAt = now();
      notifyUsers(data, proposalRecipients(proposal).filter((userId) => userId !== actor.id), { tenantId: proposal.tenantId, kind: 'institution_response', title: '기관이 정책제안에 답변을 남겼습니다', body: proposal.title, proposalId: proposal.id });
      audit(data, actor, 'institution_response_recorded', proposal.id, { tenantId: proposal.tenantId }); store.write(data); return json(res, 201, proposal);
    }
    const proposalMatch = pathname.match(/^\/api\/proposals\/([^/]+)$/);
    if (req.method === 'PATCH' && proposalMatch) {
      const proposal = data.proposals.find((entry) => entry.id === proposalMatch[1]); if (!proposal || !proposalVisible(actor, proposal)) return sendError(res, 404, '제안서를 찾을 수 없습니다.');
      if (!canEditProposal(actor, proposal)) return sendError(res, 403, '제안서를 수정할 권한이 없습니다.');
      const body = await parseBody(req);
      if (body.title) proposal.title = String(body.title).slice(0, 200);
      if (body.topic) proposal.topic = String(body.topic).slice(0, 80);
      if (body.dueAt === null || body.dueAt === '' || /^\d{4}-\d{2}-\d{2}$/.test(body.dueAt || '')) proposal.dueAt = body.dueAt || null;
      if (body.sections) proposal.sections = { ...proposal.sections, ...Object.fromEntries(Object.entries(body.sections).map(([key, value]) => [key, String(value).slice(0, 12000)])) };
      if (Array.isArray(body.contributors) && (canManageTenant(actor, proposal.tenantId) || proposal.ownerId === actor.id)) {
        const previous = new Set(proposal.contributors || []);
        proposal.contributors = [...new Set([proposal.ownerId, ...body.contributors].filter((userId) => data.users.some((user) => user.id === userId && user.tenantId === proposal.tenantId && user.active)))].slice(0, 40);
        const added = proposal.contributors.filter((userId) => userId !== actor.id && !previous.has(userId));
        notifyUsers(data, added, { tenantId: proposal.tenantId, kind: 'proposal_collaborator_added', title: '정책제안 공동 작성자로 추가되었습니다', body: proposal.title, proposalId: proposal.id });
      }
      proposal.updatedAt = now(); proposal.versions.push({ id: id('version'), label: `v${proposal.versions.length + 1}`, note: '내용 수정', createdBy: actor.id, createdAt: now() }); audit(data, actor, 'proposal_updated', proposal.id); store.write(data); return json(res, 200, proposal);
    }
    const statusMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/status$/);
    if (req.method === 'PATCH' && statusMatch) {
      const proposal = data.proposals.find((entry) => entry.id === statusMatch[1]); if (!proposal || !canManageTenant(actor, proposal.tenantId)) return sendError(res, 403, '제안 상태를 바꿀 권한이 없습니다.');
      const { status } = await parseBody(req); const allowed = ['draft', 'internal_review', 'consulting', 'approved', 'submitted', 'closed']; if (!allowed.includes(status)) return sendError(res, 400, '허용되지 않는 제안서 상태입니다.');
      proposal.status = status; proposal.updatedAt = now(); audit(data, actor, 'proposal_status_changed', proposal.id, { status }); store.write(data); return json(res, 200, proposal);
    }
    const feedbackMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/feedback$/);
    if (req.method === 'POST' && feedbackMatch) {
      const proposal = data.proposals.find((entry) => entry.id === feedbackMatch[1]); if (!proposal || !proposalVisible(actor, proposal)) return sendError(res, 404, '제안서를 찾을 수 없습니다.');
      const body = await parseBody(req); if (!body.body?.trim()) return sendError(res, 400, '피드백 내용을 입력해 주세요.');
      const feedback = { id: id('feedback'), section: body.section || 'proposal', type: body.type || '질문', body: String(body.body).slice(0, 3000), authorId: actor.id, status: 'open', createdAt: now() };
      proposal.feedback.push(feedback); proposal.updatedAt = now(); audit(data, actor, 'feedback_added', proposal.id, { feedbackId: feedback.id }); store.write(data); return json(res, 201, feedback);
    }
    const resolveMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/feedback\/([^/]+)$/);
    if (req.method === 'PATCH' && resolveMatch) {
      const proposal = data.proposals.find((entry) => entry.id === resolveMatch[1]); if (!proposal || !canEditProposal(actor, proposal)) return sendError(res, 403, '피드백 처리 권한이 없습니다.');
      const feedback = proposal.feedback.find((entry) => entry.id === resolveMatch[2]); if (!feedback) return sendError(res, 404, '피드백을 찾을 수 없습니다.');
      const { status } = await parseBody(req); feedback.status = status === 'resolved' ? 'resolved' : 'open'; feedback.resolvedBy = actor.id; audit(data, actor, 'feedback_status_changed', proposal.id, { feedbackId: feedback.id, status: feedback.status }); store.write(data); return json(res, 200, feedback);
    }
    const consultationMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/consultation$/);
    if (req.method === 'POST' && consultationMatch) {
      const proposal = data.proposals.find((entry) => entry.id === consultationMatch[1]); if (!proposal || !canEditProposal(actor, proposal)) return sendError(res, 403, '컨설팅을 요청할 권한이 없습니다.');
      const body = await parseBody(req); const reviewer = body.reviewerId ? data.users.find((user) => user.id === body.reviewerId && user.tenantId === proposal.tenantId && user.active && user.role === 'reviewer') : null;
      if (body.reviewerId && !reviewer) return sendError(res, 400, '같은 참여기구의 활성 외부 검토자를 선택해 주세요.');
      const priorReviewerId = proposal.consultation?.reviewerId; if (priorReviewerId && priorReviewerId !== reviewer?.id) { const priorReviewer = data.users.find((user) => user.id === priorReviewerId); if (priorReviewer?.assignedProposalIds) priorReviewer.assignedProposalIds = priorReviewer.assignedProposalIds.filter((proposalId) => proposalId !== proposal.id); }
      if (reviewer) reviewer.assignedProposalIds = [...new Set([...(reviewer.assignedProposalIds || []), proposal.id])];
      proposal.consultation = { requestedAt: now(), requestedBy: actor.id, reviewerId: reviewer?.id || null, scope: body.scope || '구조와 근거 검토', status: reviewer ? 'requested' : 'awaiting_assignment' }; proposal.status = 'consulting';
      data.consultationAssignments ||= []; const existing = data.consultationAssignments.find((entry) => entry.proposalId === proposal.id); const assignment = { id: existing?.id || id('assignment'), tenantId: proposal.tenantId, proposalId: proposal.id, reviewerId: reviewer?.id || null, status: reviewer ? 'requested' : 'awaiting_assignment', dueAt: body.dueAt || null, createdAt: existing?.createdAt || now(), updatedAt: now() }; if (existing) Object.assign(existing, assignment); else data.consultationAssignments.unshift(assignment);
      audit(data, actor, 'consultation_requested', proposal.id, { reviewerId: reviewer?.id || null }); store.write(data); return json(res, 201, proposal);
    }
    const submitMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/submit$/);
    if (req.method === 'POST' && submitMatch) {
      const proposal = data.proposals.find((entry) => entry.id === submitMatch[1]); if (!proposal || !canManageTenant(actor, proposal.tenantId)) return sendError(res, 403, '최종 제출을 기록할 권한이 없습니다.');
      const body = await parseBody(req); if (!body.destination?.trim()) return sendError(res, 400, '제출처를 입력해 주세요.');
      proposal.status = 'submitted'; proposal.finalSubmission = { submittedAt: now(), destination: body.destination, fileName: body.fileName || '최종제출본.pdf', hash: `demo-${crypto.createHash('sha256').update(`${proposal.id}:${now()}`).digest('hex').slice(0, 12)}`, recordedBy: actor.id }; proposal.updatedAt = now(); audit(data, actor, 'submission_recorded', proposal.id, proposal.finalSubmission); store.write(data); return json(res, 201, proposal);
    }
    const progressMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/progress$/);
    if (req.method === 'POST' && progressMatch) {
      const proposal = data.proposals.find((entry) => entry.id === progressMatch[1]); if (!proposal || !canManageTenant(actor, proposal.tenantId)) return sendError(res, 403, '제출 경과를 기록할 권한이 없습니다.');
      const body = await parseBody(req); if (!body.body?.trim()) return sendError(res, 400, '경과 내용을 입력해 주세요.');
      proposal.progress.push({ id: id('progress'), body: String(body.body).slice(0, 3000), status: body.status || 'awaiting_response', createdBy: actor.id, createdAt: now() }); audit(data, actor, 'progress_recorded', proposal.id); store.write(data); return json(res, 201, proposal);
    }
    if (req.method === 'POST' && pathname === '/api/issues') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); if (!tenantId || !canManageTenant(actor, tenantId)) return sendError(res, 403, '이슈를 발행할 권한이 없습니다.');
      if (!body.title?.trim() || !body.sourceName?.trim()) return sendError(res, 400, '이슈 제목과 출처를 입력해 주세요.'); const issue = { id: id('issue'), tenantId, title: String(body.title).trim().slice(0, 200), sourceName: String(body.sourceName).trim().slice(0, 120), sourceUrl: /^https:\/\//i.test(body.sourceUrl || '') ? body.sourceUrl.slice(0, 1000) : '', checkedAt: body.checkedAt || now().slice(0, 10), editorNote: String(body.editorNote || '').slice(0, 3000), visibility: 'tenant', createdBy: actor.id, createdAt: now() };
      data.issues.unshift(issue); audit(data, actor, 'issue_created', issue.id); store.write(data); return json(res, 201, issue);
    }
    const issueMatch = pathname.match(/^\/api\/issues\/([^/]+)$/);
    if (req.method === 'PATCH' && issueMatch) {
      const issue = data.issues.find((entry) => entry.id === issueMatch[1]); if (!issue || !canManageTenant(actor, issue.tenantId)) return sendError(res, 403, '이슈를 수정할 권한이 없습니다.'); const body = await parseBody(req);
      for (const key of ['title', 'sourceName', 'sourceUrl', 'checkedAt', 'editorNote']) if (typeof body[key] === 'string') issue[key] = body[key].slice(0, key === 'editorNote' ? 3000 : 1000); audit(data, actor, 'issue_updated', issue.id); store.write(data); return json(res, 200, issue);
    }
    if (req.method === 'POST' && pathname === '/api/announcements') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); if (!tenantId || !canManageTenant(actor, tenantId)) return sendError(res, 403, '공지를 발행할 권한이 없습니다.'); if (!body.title?.trim() || !body.body?.trim()) return sendError(res, 400, '공지 제목과 내용을 입력해 주세요.');
      const target = ['all', 'chairs', 'members', 'division'].includes(body.target) ? body.target : 'all'; const tenant = data.tenants.find((entry) => entry.id === tenantId); const orgNodeId = target === 'division' && tenant?.settings?.orgChart?.nodes?.some((node) => node.id === body.orgNodeId) ? body.orgNodeId : null;
      if (target === 'division' && !orgNodeId) return sendError(res, 400, '분과 공지는 대상 분과를 지정해 주세요.');
      const announcement = { id: id('notice'), tenantId, title: String(body.title).trim().slice(0, 200), body: String(body.body).trim().slice(0, 5000), target, orgNodeId, createdBy: actor.id, createdAt: now() }; data.announcements.unshift(announcement); audit(data, actor, 'announcement_created', announcement.id, { target, orgNodeId }); store.write(data); return json(res, 201, announcement);
    }
    if (req.method === 'POST' && pathname === '/api/document-packages') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId);
      if (!tenantId || !canManageTenant(actor, tenantId)) return sendError(res, 403, '통합 자료를 만들 권한이 없습니다.');
      const type = DOCUMENT_PACKAGE_TYPES.has(body.type) ? body.type : '';
      const title = cleanText(body.title, 180);
      const sourceItemIds = [...new Set(Array.isArray(body.sourceItemIds) ? body.sourceItemIds.filter((value) => typeof value === 'string') : [])].slice(0, 25);
      const sourceRecordIds = [...new Set(Array.isArray(body.sourceRecordIds) ? body.sourceRecordIds.filter((value) => typeof value === 'string') : [])].slice(0, 25);
      const archiveSources = sourceItemIds.map((sourceId) => data.archiveItems.find((entry) => entry.id === sourceId && entry.tenantId === tenantId)).filter(Boolean).map((source) => ({ id: source.id, title: source.title, category: source.category, body: source.body, archivedAt: source.updatedAt || source.createdAt }));
      const recordSources = sourceRecordIds.map((sourceId) => data.recordFiles.find((entry) => entry.id === sourceId && entry.tenantId === tenantId)).filter(Boolean).map((source) => ({ id: source.id, title: source.title, category: source.category, body: source.versions?.[0]?.body || '', archivedAt: source.updatedAt || source.createdAt, recordVersion: source.versions?.[0]?.version || 1 }));
      const sources = [...archiveSources, ...recordSources];
      if (!type || !title) return sendError(res, 400, '문서 종류와 제목을 입력해 주세요.');
      if (!sources.length) return sendError(res, 400, '통합할 보관 기록을 한 건 이상 선택해 주세요.');
      const item = { id: id('document'), tenantId, type, title, recipient: cleanText(body.recipient, 200), summary: cleanText(body.summary, 4000), sources, createdBy: actor.id, createdAt: now(), updatedAt: now() };
      data.documentPackages.unshift(item); audit(data, actor, 'document_package_created', item.id, { tenantId, type, sourceCount: sources.length }); store.write(data); return json(res, 201, item);
    }
    if (req.method === 'POST' && pathname === '/api/archive-folders') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); if (!tenantId || !canManageTenant(actor, tenantId)) return sendError(res, 403, '폴더를 만들 권한이 없습니다.'); const name = cleanText(body.name, 80); if (!name) return sendError(res, 400, '폴더 이름을 입력해 주세요.');
      const folder = { id: id('archive-folder'), tenantId, name, kind: 'custom', createdAt: now(), createdBy: actor.id }; data.archiveFolders.push(folder); audit(data, actor, 'archive_folder_created', folder.id, { tenantId, name }); store.write(data); return json(res, 201, folder);
    }
    if (req.method === 'PATCH' && pathname === '/api/archive-categories') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); const tenant = data.tenants.find((entry) => entry.id === tenantId);
      if (!tenant || !canManageTenant(actor, tenantId)) return sendError(res, 403, '구분 설정을 바꿀 권한이 없습니다.');
      const incoming = Array.isArray(body.categories) ? body.categories : [];
      if (incoming.length !== DEFAULT_ARCHIVE_CATEGORIES.length) return sendError(res, 400, '구분은 7개 색상 슬롯을 모두 포함해야 합니다.');
      const ids = new Set(incoming.map((item) => item?.id)); const colors = new Set(incoming.map((item) => item?.color));
      if (ids.size !== DEFAULT_ARCHIVE_CATEGORIES.length || !DEFAULT_ARCHIVE_CATEGORIES.every((item) => ids.has(item.id)) || colors.size !== ARCHIVE_CATEGORY_TONES.length || !ARCHIVE_CATEGORY_TONES.every((color) => colors.has(color))) return sendError(res, 400, '빨강부터 보라까지의 7색을 각각 한 번씩 선택해 주세요.');
      tenant.settings ||= {}; tenant.settings.archiveCategories = DEFAULT_ARCHIVE_CATEGORIES.map((fallback) => { const item = incoming.find((entry) => entry.id === fallback.id) || fallback; return { id: fallback.id, name: cleanText(item.name, 40) || fallback.name, color: item.color }; });
      audit(data, actor, 'archive_categories_updated', tenant.id, { categories: tenant.settings.archiveCategories }); store.write(data); return json(res, 200, tenant.settings.archiveCategories);
    }
    const archiveDashboardRecordMatch = pathname.match(/^\/api\/archive-dashboard-records\/(meeting|proposal|issue|archive|file)\/([^/]+)$/);
    if (req.method === 'PATCH' && archiveDashboardRecordMatch) {
      const [, type, recordId] = archiveDashboardRecordMatch; const collection = type === 'meeting' ? data.meetings : type === 'proposal' ? data.proposals : type === 'issue' ? data.issues : type === 'file' ? data.recordFiles : data.archiveItems;
      const item = collection.find((entry) => entry.id === recordId); if (!item || !canManageTenant(actor, item.tenantId)) return sendError(res, 403, '기록 구분을 바꿀 권한이 없습니다.');
      const body = await parseBody(req); const tenant = data.tenants.find((entry) => entry.id === item.tenantId); const categories = ensureArchiveCategories(tenant); const category = categories.find((entry) => entry.id === body.categoryId);
      if (!category) return sendError(res, 400, '선택한 구분을 찾을 수 없습니다.');
      if (type === 'archive' || type === 'file') { item.categoryId = category.id; item.category = category.name; } else item.archiveCategoryId = category.id;
      item.updatedAt = now(); audit(data, actor, 'archive_record_category_updated', item.id, { type, categoryId: category.id }); store.write(data); return json(res, 200, { id: item.id, type, categoryId: category.id, updatedAt: item.updatedAt });
    }
    if (req.method === 'POST' && pathname === '/api/archive-items') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); if (!tenantId || !canManageTenant(actor, tenantId)) return sendError(res, 403, '자료를 등록할 권한이 없습니다.'); if (!body.title?.trim() || !body.body?.trim()) return sendError(res, 400, '자료 제목과 내용을 입력해 주세요.'); const targetTenant = data.tenants.find((tenant) => tenant.id === tenantId); const categories = ensureArchiveCategories(targetTenant); const category = categories.find((item) => item.id === body.categoryId) || categories.find((item) => item.id === defaultArchiveCategoryId('memo', body.category)) || categories[0]; const folderId = archiveFolderFor(data, tenantId, body.folderId) ? body.folderId : archiveFolderId(tenantId, 'memo');
      const item = { id: id('archive'), tenantId, folderId, kind: 'memo', title: String(body.title).trim().slice(0, 200), category: category.name, categoryId: category.id, body: String(body.body).trim().slice(0, 8000), sourceUrl: /^https:\/\//i.test(body.sourceUrl || '') ? body.sourceUrl.slice(0, 1000) : '', source: null, notes: [], history: [archiveHistoryEntry(actor, targetTenant, 'memo_created', '새 메모 파일을 만들었습니다.')], visibility: 'tenant', createdBy: actor.id, createdAt: now(), updatedAt: now() }; data.archiveItems.unshift(item); audit(data, actor, 'archive_item_created', item.id, { tenantId, folderId, kind: item.kind, categoryId: item.categoryId }); store.write(data); return json(res, 201, item);
    }
    if (req.method === 'POST' && pathname === '/api/archive-items/from-record') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); if (!tenantId || !canManageTenant(actor, tenantId)) return sendError(res, 403, '운영 기록을 보관할 권한이 없습니다.'); const snapshot = sourceArchiveSnapshot(data, tenantId, body.sourceType, body.sourceId); if (!snapshot) return sendError(res, 404, '보관할 운영 기록을 찾을 수 없습니다.'); const targetTenant = data.tenants.find((tenant) => tenant.id === tenantId); const defaultFolderKey = body.sourceType === 'meeting' ? 'meeting' : ['issue', 'announcement'].includes(body.sourceType) ? 'notice' : ['handover', 'report'].includes(body.sourceType) ? 'handover' : 'proposal'; const folderId = archiveFolderFor(data, tenantId, body.folderId) ? body.folderId : archiveFolderId(tenantId, defaultFolderKey); const existing = data.archiveItems.find((item) => item.tenantId === tenantId && item.source?.type === body.sourceType && item.source?.id === body.sourceId);
      if (existing) { const fromFolderId = existing.folderId; existing.title = snapshot.title; existing.category = snapshot.category; existing.body = snapshot.body; existing.folderId = folderId; existing.updatedAt = now(); existing.history.unshift(archiveHistoryEntry(actor, targetTenant, fromFolderId === folderId ? 'source_refreshed' : 'source_moved_and_refreshed', `${snapshot.sourceLabel} 기록을 최신 내용으로 갱신했습니다.`)); audit(data, actor, 'archive_source_refreshed', existing.id, { sourceType: body.sourceType, sourceId: body.sourceId, folderId }); store.write(data); return json(res, 200, existing); }
      const item = { id: id('archive'), tenantId, folderId, kind: 'record_snapshot', title: snapshot.title, category: snapshot.category, body: snapshot.body, sourceUrl: '', source: { type: body.sourceType, id: body.sourceId, label: snapshot.sourceLabel, recordedAt: snapshot.recordedAt || now() }, notes: [], history: [archiveHistoryEntry(actor, targetTenant, 'source_archived', `${snapshot.sourceLabel} 기록을 보관했습니다.`)], visibility: 'tenant', createdBy: actor.id, createdAt: now(), updatedAt: now() }; data.archiveItems.unshift(item); audit(data, actor, 'archive_source_created', item.id, { sourceType: body.sourceType, sourceId: body.sourceId, folderId }); store.write(data); return json(res, 201, item);
    }
    const archiveItemMatch = pathname.match(/^\/api\/archive-items\/([^/]+)$/);
    if (req.method === 'PATCH' && archiveItemMatch) {
      const item = data.archiveItems.find((entry) => entry.id === archiveItemMatch[1]); if (!item || !canManageTenant(actor, item.tenantId)) return sendError(res, 404, '수정할 보관 자료를 찾을 수 없습니다.'); const body = await parseBody(req); const targetTenant = data.tenants.find((tenant) => tenant.id === item.tenantId); let changed = false;
      if (typeof body.folderId === 'string' && body.folderId !== item.folderId && archiveFolderFor(data, item.tenantId, body.folderId)) { const before = item.folderId; item.folderId = body.folderId; item.history.unshift(archiveHistoryEntry(actor, targetTenant, 'moved', `${archiveFolderFor(data, item.tenantId, before)?.name || '이전 폴더'} → ${archiveFolderFor(data, item.tenantId, body.folderId)?.name || '새 폴더'}`)); changed = true; }
      if (typeof body.title === 'string' && cleanText(body.title, 200)) { item.title = cleanText(body.title, 200); changed = true; }
      if (typeof body.body === 'string' && cleanText(body.body, 8000)) { item.body = cleanText(body.body, 8000); changed = true; }
      if (changed) { item.updatedAt = now(); audit(data, actor, 'archive_item_updated', item.id, { folderId: item.folderId }); store.write(data); }
      return json(res, 200, item);
    }
    const archiveNoteMatch = pathname.match(/^\/api\/archive-items\/([^/]+)\/notes$/);
    if (req.method === 'POST' && archiveNoteMatch) {
      const item = data.archiveItems.find((entry) => entry.id === archiveNoteMatch[1]); if (!item || !canManageTenant(actor, item.tenantId)) return sendError(res, 404, '메모를 남길 보관 자료를 찾을 수 없습니다.'); const body = await parseBody(req); const noteBody = cleanText(body.body, 3000); if (!noteBody) return sendError(res, 400, '메모 내용을 입력해 주세요.'); const targetTenant = data.tenants.find((tenant) => tenant.id === item.tenantId); const note = { id: id('archive-note'), body: noteBody, createdBy: actor.id, createdAt: now(), cohort: targetTenant.cohort || '기수 미정' }; item.notes.unshift(note); item.history.unshift(archiveHistoryEntry(actor, targetTenant, 'note_added', '보관 자료에 운영 메모를 추가했습니다.')); item.updatedAt = now(); audit(data, actor, 'archive_note_added', item.id, { noteId: note.id }); store.write(data); return json(res, 201, note);
    }
    if (req.method === 'POST' && pathname === '/api/community-posts') {
      const body = await parseBody(req); const tenantId = tenantFor(actor, body.tenantId); if (!tenantId || !canSeeTenant(actor, tenantId)) return sendError(res, 403, '게시할 위원회를 선택해 주세요.');
      if (!body.title?.trim() || !body.body?.trim()) return sendError(res, 400, '제목과 내용을 입력해 주세요.');
      const post = { id: id('community'), tenantId, title: String(body.title).slice(0, 200), body: String(body.body).slice(0, 5000), kind: body.kind || 'question', visibility: 'tenant', status: 'open', authorId: actor.id, createdAt: now(), replies: [] };
      data.communityPosts.unshift(post); audit(data, actor, 'community_post_created', post.id); store.write(data); return json(res, 201, post);
    }
    const tenantMatch = pathname.match(/^\/api\/tenants\/([^/]+)$/);
    if (req.method === 'PATCH' && tenantMatch) {
      if (actor.role !== 'platform_admin') return sendError(res, 403, '운영사 관리자만 테넌트 설정을 변경할 수 있습니다.');
      const tenant = data.tenants.find((entry) => entry.id === tenantMatch[1]); if (!tenant) return sendError(res, 404, '테넌트를 찾을 수 없습니다.');
      const body = await parseBody(req); if (typeof body.active === 'boolean') tenant.active = body.active; if (Number.isInteger(body.capacity) && body.capacity > 0 && body.capacity < 10001) tenant.capacity = body.capacity; if (body.featureFlags) tenant.featureFlags = { ...tenant.featureFlags, ...body.featureFlags }; audit(data, actor, 'tenant_settings_updated', tenant.id, body); store.write(data); return json(res, 200, tenant);
    }
    return sendError(res, 404, '요청한 기능을 찾을 수 없습니다.');
  };

  const runPressReleasePoll = async () => {
    const data = store.read(); let changed = false;
    for (const tenant of data.tenants.filter((item) => item.active)) {
      const profile = ensureOrganizationProfile(tenant); if (!profile.pressReleaseFeedUrl) continue;
      await collectPressReleaseFeed(data, tenant); changed = true;
    }
    if (changed) store.write(data);
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      const publicRoutes = new Set(['/', '/explore', '/insights', '/how-it-works', '/use-cases', '/governance-and-security', '/about', '/pilot', '/login']);
      const isApplicationRoute = publicRoutes.has(url.pathname) || url.pathname.startsWith('/join/') || url.pathname === '/admin' || url.pathname.startsWith('/admin/') || url.pathname === '/workspace' || url.pathname.startsWith('/workspace/');
      const requestPath = url.pathname === '/' || isApplicationRoute ? '/public/index.html' : `/public${url.pathname}`;
      const file = path.resolve(ROOT, `.${requestPath}`);
      if (!file.startsWith(path.join(ROOT, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
      res.writeHead(200, { ...securityHeaders, 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(file).pipe(res);
    } catch (error) {
      console.error(error); sendError(res, 500, error.message || '서버에서 처리하지 못했습니다.');
    }
  });
  return { server, store, runPressReleasePoll };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server, runPressReleasePoll } = createApp();
  server.listen(PORT, () => console.log(`Governance Workroom MVP: http://localhost:${PORT}`));
  setInterval(() => { runPressReleasePoll().catch((error) => console.error('Press-release poll failed:', error.message)); }, PRESS_RELEASE_POLL_MS).unref();
}

export { createApp, createStore, ROLES };
