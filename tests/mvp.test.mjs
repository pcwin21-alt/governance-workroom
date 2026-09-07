import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../server.mjs';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-workroom-'));
const { server } = createApp({ dataFile: path.join(tempDirectory, 'governance.json') });
async function listenForTests(port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => { server.off('error', onError); reject(error); };
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => { server.off('error', onError); resolve(); });
  });
}
let testPort;
for (const candidate of [4181, 4182, 4183, 4184, 4185, 4186]) {
  try {
    await listenForTests(candidate);
    testPort = candidate;
    break;
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
  }
}
if (!testPort) throw new Error('테스트 서버에 사용할 수 있는 안전한 포트를 찾지 못했습니다.');
const base = `http://127.0.0.1:${testPort}`;

async function request(pathname, options = {}, token = null) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function multipartRequest(pathname, form, token = null) {
  const response = await fetch(`${base}${pathname}`, { method: 'POST', body: form, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
function storedZip(entries) {
  const locals = []; const centrals = []; let offset = 0;
  for (const [name, value] of entries) {
    const nameBuffer = Buffer.from(name); const payload = Buffer.from(value); const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 8); local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(payload.length, 22); local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, payload);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt32LE(payload.length, 20); central.writeUInt32LE(payload.length, 24); central.writeUInt16LE(nameBuffer.length, 28); central.writeUInt32LE(offset, 42); centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + payload.length;
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'demo1234' }) });
  assert.equal(result.status, 200);
  return result.body.token;
}

test('general member only receives their own tenant data', async () => {
  const token = await login('member@workroom.demo');
  const result = await request('/api/bootstrap', {}, token);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.tenants.map((tenant) => tenant.id), ['tenant-2030']);
  assert.equal(result.body.users.some((user) => user.email === 'other@workroom.demo'), false);
});

test('reviewer only sees an assigned proposal and may leave feedback', async () => {
  const token = await login('reviewer@workroom.demo');
  const bootstrap = await request('/api/bootstrap', {}, token);
  assert.deepEqual(bootstrap.body.proposals.map((proposal) => proposal.id), ['proposal-housing']);
  const feedback = await request('/api/proposals/proposal-housing/feedback', { method: 'POST', body: JSON.stringify({ section: 'proposal', type: '질문', body: '실행 주체의 역할을 더 분명히 해주세요.' }) }, token);
  assert.equal(feedback.status, 201);
  const blocked = await request('/api/proposals', { method: 'POST', body: JSON.stringify({ title: '권한 밖 제안' }) }, token);
  assert.equal(blocked.status, 403);
});

test('member attendance and proposal draft work, while chair can record final submission', async () => {
  const memberToken = await login('member@workroom.demo');
  const attendance = await request('/api/meetings/meeting-1/attendance', { method: 'PATCH', body: JSON.stringify({ status: 'attending' }) }, memberToken);
  assert.equal(attendance.status, 200);
  assert.equal(attendance.body.rsvp['member-1'], 'attending');
  const proposal = await request('/api/proposals', { method: 'POST', body: JSON.stringify({ title: '테스트 정책제안', topic: '참여·지역' }) }, memberToken);
  assert.equal(proposal.status, 201);
  let chairLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'chair@workroom.demo', password: 'demo1234' }) });
  if (chairLogin.status === 401) chairLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'chair@workroom.demo', password: 'representative-password-2026' }) });
  assert.equal(chairLogin.status, 200);
  const chairToken = chairLogin.body.token;
  const submitted = await request(`/api/proposals/${proposal.body.id}/submit`, { method: 'POST', body: JSON.stringify({ destination: '정책 담당 부서(합성)', fileName: 'test.pdf' }) }, chairToken);
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.status, 'submitted');
  assert.match(submitted.body.finalSubmission.hash, /^demo-/);
});

test('a youth proposal delivery reaches the institution inbox and the reply returns only to proposal contributors', async () => {
  const memberToken = await login('member@workroom.demo');
  const proposal = await request('/api/proposals', { method: 'POST', body: JSON.stringify({ title: '기관 전달 흐름 검증', topic: '참여·지역' }) }, memberToken);
  assert.equal(proposal.status, 201);

  const delivered = await request(`/api/proposals/${proposal.body.id}/institution-delivery`, { method: 'POST', body: JSON.stringify({ message: '기관 운영팀의 확인과 다음 안내를 요청합니다.' }) }, memberToken);
  assert.equal(delivered.status, 201);
  assert.equal(delivered.body.institutionDelivery.status, 'sent');

  const chairToken = await login('chair@workroom.demo');
  const chairBootstrap = await request('/api/bootstrap', {}, chairToken);
  assert.equal(chairBootstrap.body.proposals.some((item) => item.id === proposal.body.id && item.institutionDelivery.status === 'sent'), true);
  assert.equal(chairBootstrap.body.notifications.some((item) => item.proposalId === proposal.body.id && item.kind === 'proposal_delivered'), true);

  const received = await request(`/api/proposals/${proposal.body.id}/institution-received`, { method: 'POST', body: '{}' }, chairToken);
  assert.equal(received.status, 200);
  assert.equal(received.body.institutionDelivery.status, 'received');
  const replied = await request(`/api/proposals/${proposal.body.id}/institution-response`, { method: 'POST', body: JSON.stringify({ message: '운영팀에서 확인했습니다. 다음 회의 전 검토 의견을 남기겠습니다.' }) }, chairToken);
  assert.equal(replied.status, 201);
  assert.equal(replied.body.institutionDelivery.status, 'responded');

  const memberBootstrap = await request('/api/bootstrap', {}, memberToken);
  assert.equal(memberBootstrap.body.notifications.some((item) => item.proposalId === proposal.body.id && item.kind === 'institution_response'), true);
  assert.equal(memberBootstrap.body.proposals.find((item) => item.id === proposal.body.id).institutionDelivery.response.body.includes('확인했습니다'), true);

  const otherToken = await login('other@workroom.demo');
  const blocked = await request(`/api/proposals/${proposal.body.id}/institution-delivery`, { method: 'POST', body: JSON.stringify({ message: '다른 테넌트 접근' }) }, otherToken);
  assert.ok([403, 404].includes(blocked.status));
});

test('secretary can create a meeting decision and invite a member within capacity', async () => {
  const token = await login('secretary@workroom.demo');
  const decision = await request('/api/meetings/meeting-1/decisions', { method: 'POST', body: JSON.stringify({ text: '다음 회의 전에 비교 기준을 정리한다.', ownerId: 'member-1', dueAt: '2026-09-05' }) }, token);
  assert.equal(decision.status, 201);
  const invite = await request('/api/members', { method: 'POST', body: JSON.stringify({ name: '합성 신규위원', email: 'new-member@workroom.demo', role: 'member', term: '2기', ageBand: '20–24' }) }, token);
  assert.equal(invite.status, 201);
  assert.equal(invite.body.user.invitationStatus, 'invited');
});

test('chair imports a committee CSV into a review draft, edits it, and applies only approved rows', async () => {
  const chairToken = await login('chair@workroom.demo');
  const form = new FormData();
  form.append('source', new Blob(['기구명,행정안전부 2030자문단 운영 검토본\n위원장,박진감\n근거 조례,청년참여 활성화 조례\n기수,2기\n이름,이메일,역할,임기,연령대,직업,시군구\n가져온 위원,imported-member@workroom.demo,일반위원,2기,25–29,활동가,서울 성동구\n검토 제외 위원,exclude-member@workroom.demo,일반위원,2기,30–34,회사원,서울 마포구'], { type: 'text/csv' }), 'committee.csv');
  const created = await multipartRequest('/api/imports', form, chairToken);
  assert.equal(created.status, 201);
  assert.equal(created.body.parser, 'csv_table');
  assert.equal(created.body.candidates.organizationProfile.displayName, '행정안전부 2030자문단 운영 검토본');
  assert.equal(created.body.candidates.organizationProfile.contactEmail, '');
  assert.equal(created.body.candidates.memberCount, 2);

  const memberToken = await login('member@workroom.demo');
  const memberBootstrap = await request('/api/bootstrap', {}, memberToken);
  assert.deepEqual(memberBootstrap.body.imports, []);
  const otherToken = await login('other@workroom.demo');
  const isolated = await request(`/api/imports/${created.body.id}`, { method: 'PATCH', body: JSON.stringify({ members: [] }) }, otherToken);
  assert.equal(isolated.status, 404);

  const chairBootstrap = await request('/api/bootstrap', {}, chairToken);
  const imported = chairBootstrap.body.imports.find((item) => item.id === created.body.id);
  const reviewed = await request(`/api/imports/${created.body.id}`, { method: 'PATCH', body: JSON.stringify({ organizationProfile: { ...imported.review.organizationProfile, activityPeriod: '2026년 하반기' }, members: imported.review.members.map((item) => ({ ...item, included: item.email === 'imported-member@workroom.demo' })) }) }, chairToken);
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.review.members.filter((item) => item.included).length, 1);

  const applied = await request(`/api/imports/${created.body.id}/apply`, { method: 'POST', body: '{}' }, chairToken);
  assert.equal(applied.status, 200);
  assert.equal(applied.body.status, 'applied');
  const after = await request('/api/bootstrap', {}, chairToken);
  assert.equal(after.body.tenants[0].settings.organizationProfile.displayName, '행정안전부 2030자문단 운영 검토본');
  const importedMember = after.body.users.find((item) => item.email === 'imported-member@workroom.demo');
  assert.equal(importedMember.active, false);
  assert.equal(importedMember.invitationStatus, 'imported_pending_invitation');
  assert.equal(after.body.users.some((item) => item.email === 'exclude-member@workroom.demo'), false);
  const cannotApplyAgain = await request(`/api/imports/${created.body.id}/apply`, { method: 'POST', body: '{}' }, chairToken);
  assert.equal(cannotApplyAgain.status, 409);
});

test('chair can stage Excel, PDF, and legacy HWP sources without automatically publishing them', async () => {
  const chairToken = await login('chair@workroom.demo');
  const worksheet = '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>이름</t></is></c><c r="B1" t="inlineStr"><is><t>이메일</t></is></c><c r="C1" t="inlineStr"><is><t>역할</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>엑셀 위원</t></is></c><c r="B2" t="inlineStr"><is><t>excel-member@workroom.demo</t></is></c><c r="C2" t="inlineStr"><is><t>분과장</t></is></c></row></sheetData></worksheet>';
  const excelForm = new FormData(); excelForm.append('source', new Blob([storedZip([['xl/worksheets/sheet1.xml', worksheet]])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'members.xlsx');
  const excel = await multipartRequest('/api/imports', excelForm, chairToken);
  assert.equal(excel.status, 201);
  assert.equal(excel.body.parser, 'xlsx_table');
  assert.equal(excel.body.candidates.memberCount, 1);
  const pdfForm = new FormData(); pdfForm.append('source', new Blob(['%PDF-1.4\n(Committee source review) Tj'], { type: 'application/pdf' }), 'committee.pdf');
  const pdf = await multipartRequest('/api/imports', pdfForm, chairToken);
  assert.equal(pdf.status, 201);
  assert.equal(pdf.body.parser, 'pdf_text_best_effort');
  const hwpForm = new FormData(); hwpForm.append('source', new Blob(['legacy-hwp-binary-placeholder']), 'legacy.hwp');
  const hwp = await multipartRequest('/api/imports', hwpForm, chairToken);
  assert.equal(hwp.status, 201);
  assert.equal(hwp.body.parser, 'manual_review');
  assert.match(hwp.body.notes.join(' '), /구형 HWP/);
});

test('chair can send an invitation link, approve a completed application, and the new member can log in', async () => {
  const chairToken = await login('chair@workroom.demo');
  const invitation = await request('/api/invitations', { method: 'POST', body: JSON.stringify({ email: 'approved-member@workroom.demo', role: 'member', term: '2기' }) }, chairToken);
  assert.equal(invitation.status, 201);
  const preview = await request(`/api/invitations/${invitation.body.token}/public`);
  assert.equal(preview.status, 200);
  const accepted = await request(`/api/invitations/${invitation.body.token}/accept`, { method: 'POST', body: JSON.stringify({ name: '승인 대기 위원', password: 'approved1234', ageBand: '25–29' }) });
  assert.equal(accepted.status, 201);
  const approved = await request(`/api/invitations/${invitation.body.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) }, chairToken);
  assert.equal(approved.status, 200);
  const loginResult = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'approved-member@workroom.demo', password: 'approved1234' }) });
  assert.equal(loginResult.status, 200);
});

test('chair can update meetings, record actual attendance, and complete decisions', async () => {
  const chairToken = await login('chair@workroom.demo');
  const updated = await request('/api/meetings/meeting-1', { method: 'PATCH', body: JSON.stringify({ title: '수정된 정기회의', agendaText: '첫 안건\n둘째 안건', materialText: 'https://example.org/brief', participantIds: ['chair-1', 'member-1'], status: 'scheduled' }) }, chairToken);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.agenda.length, 2);
  assert.equal(updated.body.participantIds.includes('member-1'), true);
  const actual = await request('/api/meetings/meeting-1/attendance/member-1', { method: 'PATCH', body: JSON.stringify({ status: 'attending' }) }, chairToken);
  assert.equal(actual.status, 200);
  const decision = await request('/api/meetings/meeting-1/decisions', { method: 'POST', body: JSON.stringify({ text: '수정 검증 과제', ownerId: 'member-1' }) }, chairToken);
  const completed = await request(`/api/meetings/meeting-1/decisions/${decision.body.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) }, chairToken);
  assert.equal(completed.body.status, 'completed');
});

test('chair can create content and make a consultation visible to its assigned reviewer', async () => {
  const chairToken = await login('chair@workroom.demo');
  const issue = await request('/api/issues', { method: 'POST', body: JSON.stringify({ title: '합성 신규 이슈', sourceName: '공식 예시', checkedAt: '2026-08-24', editorNote: '운영 메모' }) }, chairToken);
  assert.equal(issue.status, 201);
  const notice = await request('/api/announcements', { method: 'POST', body: JSON.stringify({ title: '합성 공지', body: '회의 전 확인할 내용입니다.' }) }, chairToken);
  assert.equal(notice.status, 201);
  const archive = await request('/api/archive-items', { method: 'POST', body: JSON.stringify({ title: '합성 인수인계', category: '인수인계', body: '다음 기수에 남길 판단' }) }, chairToken);
  assert.equal(archive.status, 201);
  const proposal = await request('/api/proposals', { method: 'POST', body: JSON.stringify({ title: '검토 배정 제안', topic: '참여·지역' }) }, chairToken);
  const consultation = await request(`/api/proposals/${proposal.body.id}/consultation`, { method: 'POST', body: JSON.stringify({ reviewerId: 'review-1', scope: '근거 검토' }) }, chairToken);
  assert.equal(consultation.status, 201);
  const reviewerToken = await login('reviewer@workroom.demo');
  const bootstrap = await request('/api/bootstrap', {}, reviewerToken);
  assert.equal(bootstrap.body.proposals.some((item) => item.id === proposal.body.id), true);
});

test('chair can organize operating records as drive files with folders, notes, and cohort history', async () => {
  const chairToken = await login('chair@workroom.demo');
  const initial = await request('/api/bootstrap', {}, chairToken);
  assert.equal(initial.body.archiveFolders.some((folder) => folder.name === '회의·운영 기록'), true);
  const folder = await request('/api/archive-folders', { method: 'POST', body: JSON.stringify({ name: '2기 운영 정리' }) }, chairToken);
  assert.equal(folder.status, 201);

  const archived = await request('/api/archive-items/from-record', { method: 'POST', body: JSON.stringify({ sourceType: 'meeting', sourceId: 'meeting-1', folderId: folder.body.id }) }, chairToken);
  assert.equal(archived.status, 201);
  assert.equal(archived.body.kind, 'record_snapshot');
  assert.equal(archived.body.folderId, folder.body.id);
  assert.match(archived.body.body, /회의록/);

  const note = await request(`/api/archive-items/${archived.body.id}/notes`, { method: 'POST', body: JSON.stringify({ body: '다음 기수는 참석 응답 마감일을 먼저 확인합니다.' }) }, chairToken);
  assert.equal(note.status, 201);
  assert.equal(note.body.cohort, '2기');
  const baseFolder = initial.body.archiveFolders.find((item) => item.name === '회의·운영 기록');
  const moved = await request(`/api/archive-items/${archived.body.id}`, { method: 'PATCH', body: JSON.stringify({ folderId: baseFolder.id }) }, chairToken);
  assert.equal(moved.status, 200);
  assert.equal(moved.body.folderId, baseFolder.id);
  assert.equal(moved.body.history.some((entry) => entry.type === 'moved' && entry.cohort === '2기'), true);

  const refreshed = await request('/api/archive-items/from-record', { method: 'POST', body: JSON.stringify({ sourceType: 'meeting', sourceId: 'meeting-1', folderId: baseFolder.id }) }, chairToken);
  assert.equal(refreshed.status, 200);
  assert.equal(refreshed.body.id, archived.body.id);
  const otherToken = await login('other@workroom.demo');
  const denied = await request('/api/archive-items/from-record', { method: 'POST', body: JSON.stringify({ sourceType: 'meeting', sourceId: 'meeting-1' }) }, otherToken);
  assert.equal(denied.status, 403);
});

test('secretary can create an organization unit and assign a member without crossing tenant boundaries', async () => {
  const secretaryToken = await login('secretary@workroom.demo');
  const bootstrap = await request('/api/bootstrap', {}, secretaryToken);
  const root = bootstrap.body.tenants[0].settings.orgChart.nodes.find((node) => node.parentId === null);
  assert.ok(root);
  const created = await request('/api/org-nodes', { method: 'POST', body: JSON.stringify({ name: '주거 분과', kind: '분과', parentId: root.id }) }, secretaryToken);
  assert.equal(created.status, 201);
  assert.equal(created.body.parentId, root.id);

  const assigned = await request('/api/members/member-1', { method: 'PATCH', body: JSON.stringify({ orgNodeId: created.body.id }) }, secretaryToken);
  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.orgNodeId, created.body.id);

  const reviewerToken = await login('reviewer@workroom.demo');
  const denied = await request('/api/members/member-1', { method: 'PATCH', body: JSON.stringify({ orgNodeId: created.body.id }) }, reviewerToken);
  assert.equal(denied.status, 403);
});

test('organization assignments and operating roles can be revoked without an undo endpoint', async () => {
  const chairToken = await login('chair@workroom.demo');
  const bootstrap = await request('/api/bootstrap', {}, chairToken);
  const node = bootstrap.body.tenants[0].settings.orgChart.nodes.find((item) => item.parentId !== null);
  const assigned = await request('/api/members/member-1', { method: 'PATCH', body: JSON.stringify({ role: 'division_lead', orgAssignments: [{ nodeId: node.id, position: '분과장' }] }) }, chairToken);
  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.role, 'division_lead');

  const revokedAssignment = await request('/api/members/member-1/organization-revoke', { method: 'POST', body: JSON.stringify({ scope: 'assignment', nodeId: node.id }) }, chairToken);
  assert.equal(revokedAssignment.status, 200);
  assert.equal(revokedAssignment.body.user.orgAssignments.length, 0);

  const revokedRole = await request('/api/members/member-1/organization-revoke', { method: 'POST', body: JSON.stringify({ scope: 'role' }) }, chairToken);
  assert.equal(revokedRole.status, 200);
  assert.equal(revokedRole.body.user.role, 'member');
  const unavailable = await request('/api/organization/undo', { method: 'POST', body: JSON.stringify({}) }, chairToken);
  assert.equal(unavailable.status, 404);
});

test('chair can configure role permissions, manage attendance, and keep multiple organization assignments', async () => {
  const chairToken = await login('chair@workroom.demo');
  const governance = await request('/api/tenant-governance', { method: 'PATCH', body: JSON.stringify({ positionLabels: { vice_chair: '부위원장', division_lead: '주거 분과장' }, rolePermissions: { division_lead: { manage: true, share: true } } }) }, chairToken);
  assert.equal(governance.status, 200);
  assert.equal(governance.body.positionLabels.division_lead, '주거 분과장');
  assert.equal(governance.body.rolePermissions.division_lead.manage, true);

  const attendance = await request('/api/meetings/meeting-0/attendance/member-1', { method: 'PATCH', body: JSON.stringify({ status: 'absent' }) }, chairToken);
  assert.equal(attendance.status, 200);
  assert.equal(attendance.body.attendance['member-1'], 'absent');

  const bootstrap = await request('/api/bootstrap', {}, chairToken);
  const nodes = bootstrap.body.tenants[0].settings.orgChart.nodes;
  const assignment = await request('/api/members/member-1', { method: 'PATCH', body: JSON.stringify({ orgAssignments: [{ nodeId: nodes[0].id, position: '일반위원' }, { nodeId: nodes[1].id, position: '주거 분과장' }] }) }, chairToken);
  assert.equal(assignment.status, 200);
  assert.equal(assignment.body.orgAssignments.length, 2);
});

test('chair can update the organization profile while secretary cannot', async () => {
  const chairToken = await login('chair@workroom.demo');
  const updated = await request('/api/organization-profile', { method: 'PATCH', body: JSON.stringify({ displayName: '2030 청년참여기구 (합성)', institutionName: '행정안전부 (합성 예시)', representativeName: '김도윤', representativeRole: '위원장', contactEmail: 'chair@workroom.demo', contactPhone: '02-2030-2030', ordinanceName: '「청년참여 활성화 조례」 (합성 예시)', ordinanceArticle: '제00조', termLabel: '2기', activityPeriod: '2026년 7월 ~ 12월', logoText: '2030' }) }, chairToken);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.representativeRole, '위원장');
  assert.equal(updated.body.institutionName, '행정안전부 (합성 예시)');
  const secretaryToken = await login('secretary@workroom.demo');
  const denied = await request('/api/organization-profile', { method: 'PATCH', body: JSON.stringify({ representativeName: '권한 없음' }) }, secretaryToken);
  assert.equal(denied.status, 403);
  const rootToken = await login('root@workroom.demo');
  const platformDenied = await request('/api/organization-profile', { method: 'PATCH', body: JSON.stringify({ tenantId: 'tenant-2030', representativeName: '운영사 변경 시도' }) }, rootToken);
  assert.equal(platformDenied.status, 403);
});

test('a member can update only their own workspace profile', async () => {
  const memberToken = await login('member@workroom.demo');
  const updated = await request('/api/me/profile', { method: 'PATCH', body: JSON.stringify({ name: '이하늘', ageBand: '25–29', job: '청년 활동가', region: '서울 성동구' }) }, memberToken);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.job, '청년 활동가');
  const bootstrap = await request('/api/bootstrap', {}, memberToken);
  assert.equal(bootstrap.body.me.region, '서울 성동구');
});

test('institution press-release collection requires a configured public HTTPS feed', async () => {
  const chairToken = await login('chair@workroom.demo');
  const missing = await request('/api/press-release-feed/collect', { method: 'POST', body: '{}' }, chairToken);
  assert.equal(missing.status, 400);
  const privateFeed = await request('/api/organization-profile', { method: 'PATCH', body: JSON.stringify({ pressReleaseFeedUrl: 'http://127.0.0.1/internal.xml' }) }, chairToken);
  assert.equal(privateFeed.status, 400);
  const memberToken = await login('member@workroom.demo');
  const denied = await request('/api/press-release-feed/collect', { method: 'POST', body: '{}' }, memberToken);
  assert.equal(denied.status, 403);
});

test('root can suspend a tenant and suspended tenant access is blocked', async () => {
  const rootToken = await login('root@workroom.demo');
  const changed = await request('/api/tenants/tenant-sandbox', { method: 'PATCH', body: JSON.stringify({ active: false }) }, rootToken);
  assert.equal(changed.status, 200);
  const otherToken = await login('other@workroom.demo');
  const access = await request('/api/bootstrap', {}, otherToken);
  assert.equal(access.status, 403);
});

test('control plane is root-only and can create a synthetic tenant with settings', async () => {
  const memberToken = await login('member@workroom.demo');
  const denied = await request('/api/admin/overview', {}, memberToken);
  assert.equal(denied.status, 403);

  const rootToken = await login('root@workroom.demo');
  const overview = await request('/api/admin/overview', {}, rootToken);
  assert.equal(overview.status, 200);
  assert.equal(overview.body.tenantTemplates.length, 2);

  const created = await request('/api/admin/tenants', { method: 'POST', body: JSON.stringify({ name: '파일럿 후보 기구 (합성)', cohort: '1기', capacity: 15, templateId: 'template-light', active: false }) }, rootToken);
  assert.equal(created.status, 201);
  assert.equal(created.body.active, false);
  assert.equal(created.body.settings.divisions[0], '자유 의제');
  assert.equal(created.body.serviceAccess.plan, 'template_experience');
  assert.equal(created.body.serviceAccess.dataMode, 'template_only');

  const changed = await request(`/api/admin/tenants/${created.body.id}`, { method: 'PATCH', body: JSON.stringify({ active: true, capacity: 18, featureFlags: { community: false }, serviceAccess: { plan: 'sponsored_seat', status: 'active', sponsorType: '재단', sponsorName: '합성 청년재단', seatLimit: 18, startsAt: '2026-09-01', endsAt: '2027-08-31', supportLevel: 'standard' } }) }, rootToken);
  assert.equal(changed.status, 200);
  assert.equal(changed.body.capacity, 18);
  assert.equal(changed.body.featureFlags.community, false);
  assert.equal(changed.body.serviceAccess.plan, 'sponsored_seat');
  assert.equal(changed.body.serviceAccess.sponsorName, '합성 청년재단');
  assert.equal(changed.body.serviceAccess.dataMode, 'contracted_workspace');
});

test('template-only tenants cannot save operating records until a contract or sponsored seat is activated', async () => {
  const rootToken = await login('root@workroom.demo');
  const created = await request('/api/admin/tenants', { method: 'POST', body: JSON.stringify({ name: '체험 전용 기구 (합성)', cohort: '1기', capacity: 3, templateId: 'template-light' }) }, rootToken);
  assert.equal(created.status, 201);
  const invitation = await request('/api/invitations', { method: 'POST', body: JSON.stringify({ tenantId: created.body.id, email: 'preview-member@workroom.demo', role: 'member', term: '1기' }) }, rootToken);
  assert.equal(invitation.status, 201);
  const accepted = await request(`/api/invitations/${invitation.body.token}/accept`, { method: 'POST', body: JSON.stringify({ name: '체험 구성원', password: 'preview1234' }) });
  assert.equal(accepted.status, 201);
  const approved = await request(`/api/invitations/${invitation.body.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) }, rootToken);
  assert.equal(approved.status, 200);
  const previewLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'preview-member@workroom.demo', password: 'preview1234' }) });
  assert.equal(previewLogin.status, 200);
  const previewToken = previewLogin.body.token;
  const blocked = await request('/api/proposals', { method: 'POST', body: JSON.stringify({ title: '체험 공간 기록 차단', topic: '합성' }) }, previewToken);
  assert.equal(blocked.status, 403);
  assert.match(blocked.body.error, /템플릿·체험/);
});

test('contracted workspace blocks operating records before activation and after expiry', async () => {
  const rootToken = await login('root@workroom.demo');
  const created = await request('/api/admin/tenants', { method: 'POST', body: JSON.stringify({ name: '계약 상태 검증 기구 (합성)', cohort: '1기', capacity: 3, templateId: 'template-light' }) }, rootToken);
  assert.equal(created.status, 201);
  const pendingAccess = await request(`/api/admin/tenants/${created.body.id}`, { method: 'PATCH', body: JSON.stringify({ serviceAccess: { plan: 'institutional_contract', status: 'proposal_pending' } }) }, rootToken);
  assert.equal(pendingAccess.status, 200);
  const invitation = await request('/api/invitations', { method: 'POST', body: JSON.stringify({ tenantId: created.body.id, email: 'contract-member@workroom.demo', role: 'member', term: '1기' }) }, rootToken);
  assert.equal(invitation.status, 201);
  const accepted = await request(`/api/invitations/${invitation.body.token}/accept`, { method: 'POST', body: JSON.stringify({ name: '계약 구성원', password: 'contract1234' }) });
  assert.equal(accepted.status, 201);
  const approved = await request(`/api/invitations/${invitation.body.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) }, rootToken);
  assert.equal(approved.status, 200);
  const memberLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'contract-member@workroom.demo', password: 'contract1234' }) });
  assert.equal(memberLogin.status, 200);
  const memberToken = memberLogin.body.token;
  const pending = await request('/api/proposals', { method: 'POST', body: JSON.stringify({ title: '활성화 전 차단', topic: '합성' }) }, memberToken);
  assert.equal(pending.status, 403);
  assert.match(pending.body.error, /활성화/);
  const activated = await request(`/api/admin/tenants/${created.body.id}`, { method: 'PATCH', body: JSON.stringify({ serviceAccess: { plan: 'institutional_contract', status: 'active', startsAt: '2026-01-01', endsAt: '2026-12-31' } }) }, rootToken);
  assert.equal(activated.status, 200);
  const active = await request('/api/proposals', { method: 'POST', body: JSON.stringify({ title: '활성화 후 기록', topic: '합성' }) }, memberToken);
  assert.equal(active.status, 201);
  const expired = await request(`/api/admin/tenants/${created.body.id}`, { method: 'PATCH', body: JSON.stringify({ serviceAccess: { status: 'active', startsAt: '2025-01-01', endsAt: '2025-12-31' } }) }, rootToken);
  assert.equal(expired.status, 200);
  const afterExpiry = await request('/api/proposals', { method: 'POST', body: JSON.stringify({ title: '기간 종료 차단', topic: '합성' }) }, memberToken);
  assert.equal(afterExpiry.status, 403);
  assert.match(afterExpiry.body.error, /기간이 끝났습니다/);
});

test('repeated invalid logins are rate limited per address and identifier', async () => {
  const failures = [];
  const headers = { 'x-forwarded-for': '198.51.100.10' };
  for (let index = 0; index < 10; index += 1) failures.push(await request('/api/auth/login', { method: 'POST', headers, body: JSON.stringify({ email: 'member@workroom.demo', password: 'wrong-password' }) }));
  assert.equal(failures.every((result) => result.status === 401), true);
  const limited = await request('/api/auth/login', { method: 'POST', headers, body: JSON.stringify({ email: 'member@workroom.demo', password: 'wrong-password' }) });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '900');
});

test('public pilot inquiry is stored for the platform operator and can be status-managed', async () => {
  const created = await request('/api/pilot-requests', { method: 'POST', body: JSON.stringify({ organizationName: '합성 도입 문의 기구', contactName: '문의 담당자', contactEmail: 'inquiry@workroom.demo', contactPhone: '02-0000-0000', organization: '청년위원회·자문단', blocker: '정책제안서의 피드백·최종본 관리', funding: '지자체·재단·기업·연구소 후원', inquiryConsent: true, website: '' }) });
  assert.equal(created.status, 201);
  assert.equal(created.body.status, 'received');

  const rootToken = await login('root@workroom.demo');
  const bootstrap = await request('/api/bootstrap', {}, rootToken);
  const inquiry = bootstrap.body.platform.pilotRequests.find((item) => item.id === created.body.id);
  assert.equal(inquiry.contactEmail, 'inquiry@workroom.demo');
  assert.equal(typeof bootstrap.body.platform.pilotEmailNotificationsConfigured, 'boolean');
  const updated = await request(`/api/admin/pilot-requests/${created.body.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'contacted' }) }, rootToken);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, 'contacted');

  const memberToken = await login('member@workroom.demo');
  const denied = await request(`/api/admin/pilot-requests/${created.body.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) }, memberToken);
  assert.equal(denied.status, 403);
});

test('root can record an approval-pending research request without exporting data', async () => {
  const rootToken = await login('root@workroom.demo');
  const created = await request('/api/admin/research-requests', { method: 'POST', body: JSON.stringify({ title: '합성 연구 요청', purpose: 'MVP 흐름 확인', variables: ['상태', '의제'], expiresAt: '2026-10-01' }) }, rootToken);
  assert.equal(created.status, 201);
  assert.equal(created.body.status, 'approval_pending');
  assert.deepEqual(created.body.variables, ['상태', '의제']);
});

test('chair can generate a group-only activity report and complete a cohort handover with an archive package', async () => {
  const memberToken = await login('member@workroom.demo');
  const denied = await request('/api/activity-reports', { method: 'POST', body: JSON.stringify({ title: '권한 밖 리포트' }) }, memberToken);
  assert.equal(denied.status, 403);

  const chairToken = await login('chair@workroom.demo');
  const report = await request('/api/activity-reports', { method: 'POST', body: JSON.stringify({ title: '2기 누적 활동 리포트', periodStart: '2026-08-01', periodEnd: '2026-09-30' }) }, chairToken);
  assert.equal(report.status, 201);
  assert.equal(report.body.metrics.meetingCount >= 1, true);
  assert.equal(Array.isArray(report.body.insights.actions), true);

  const plan = await request('/api/handover-plans', { method: 'POST', body: JSON.stringify({ targetCohort: '3기', summary: '주거 의제의 근거와 제출 경과를 이어받습니다.', priorityItems: '열린 피드백과 담당 부서 회신을 확인합니다.', archiveItemIds: ['archive-1'], incomingAssignments: [{ userId: 'member-1', role: 'chair' }, { userId: 'sec-1', role: 'secretary' }] }) }, chairToken);
  assert.equal(plan.status, 201);
  assert.equal(plan.body.archiveItemIds[0], 'archive-1');

  const invitation = await request('/api/invitations', { method: 'POST', body: JSON.stringify({ email: 'next-chair@workroom.demo', role: 'chair', handoverPlanId: plan.body.id, messageExtra: '다음 기수 준비 회의 전에 가입을 완료해 주세요.' }) }, chairToken);
  assert.equal(invitation.status, 201);
  assert.equal(invitation.body.term, '3기');
  assert.match(invitation.body.invitationCopy.messengerText, /다음 기수 준비 회의/);
  const nextPreview = await request(`/api/invitations/${invitation.body.token}/public`);
  assert.equal(nextPreview.body.cohort, '3기');
  const shared = await request(`/api/invitations/${invitation.body.id}/share`, { method: 'POST', body: JSON.stringify({ channel: 'copy' }) }, chairToken);
  assert.equal(shared.status, 200);
  assert.match(shared.body.invitationCopy.subject, /3기/);

  const completed = await request(`/api/handover-plans/${plan.body.id}/complete`, { method: 'POST', body: JSON.stringify({}) }, chairToken);
  assert.equal(completed.status, 200);
  assert.equal(completed.body.plan.status, 'completed');
  assert.equal(completed.body.archivePackage.includedArchiveItemIds[0], 'archive-1');

  const newChairToken = await login('member@workroom.demo');
  const bootstrap = await request('/api/bootstrap', {}, newChairToken);
  assert.equal(bootstrap.body.me.role, 'chair');
  assert.equal(bootstrap.body.tenants[0].cohort, '3기');
  assert.equal(bootstrap.body.archiveItems.some((item) => item.id === completed.body.archivePackage.id), true);
});

test('public introduction and protected application routes serve the client entry point', async () => {
  for (const pathname of ['/', '/explore', '/insights', '/how-it-works', '/use-cases', '/governance-and-security', '/about', '/pilot', '/login', '/join/example-invitation-token', '/workspace/tenant-2030/home', '/admin/overview']) {
    const response = await fetch(`${base}${pathname}`);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), /id="app"/, pathname);
  }
});

test('admin entry carries baseline browser hardening headers', async () => {
  const response = await fetch(`${base}/admin`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('password login also establishes an HttpOnly session cookie', async () => {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'root@workroom.demo', password: 'demo1234' }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie') || '';
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
});

test('Google OAuth is disabled without credentials and starts an authorization request when configured', async () => {
  const providers = await request('/api/auth/providers');
  assert.deepEqual(providers.body, { google: false, kakao: false });
  const unavailable = await request('/api/auth/google/start');
  assert.equal(unavailable.status, 503);
  const kakaoUnavailable = await request('/api/auth/kakao/start');
  assert.equal(kakaoUnavailable.status, 503);

  const authDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-google-auth-'));
  const { server: authServer } = createApp({ dataFile: path.join(authDirectory, 'governance.json'), googleOAuth: { clientId: 'test-client.apps.googleusercontent.com', clientSecret: 'test-secret' }, kakaoOAuth: { restApiKey: 'test-kakao-key', clientSecret: 'test-kakao-secret' } });
  await new Promise((resolve) => authServer.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${authServer.address().port}/api/auth/google/start`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const destination = new URL(response.headers.get('location'));
    assert.equal(destination.origin, 'https://accounts.google.com');
    assert.equal(destination.searchParams.get('client_id'), 'test-client.apps.googleusercontent.com');
    assert.equal(destination.searchParams.get('redirect_uri'), `http://127.0.0.1:${authServer.address().port}/api/auth/google/callback`);
    assert.ok(destination.searchParams.get('state'));
    const kakaoResponse = await fetch(`http://127.0.0.1:${authServer.address().port}/api/auth/kakao/start`, { redirect: 'manual' });
    assert.equal(kakaoResponse.status, 302);
    const kakaoDestination = new URL(kakaoResponse.headers.get('location'));
    assert.equal(kakaoDestination.origin, 'https://kauth.kakao.com');
    assert.equal(kakaoDestination.pathname, '/oauth/authorize');
    assert.equal(kakaoDestination.searchParams.get('client_id'), 'test-kakao-key');
    assert.equal(kakaoDestination.searchParams.get('redirect_uri'), `http://127.0.0.1:${authServer.address().port}/api/auth/kakao/callback`);
    assert.equal(kakaoDestination.searchParams.get('scope'), 'account_email');
    assert.ok(kakaoDestination.searchParams.get('state'));
  } finally {
    await new Promise((resolve) => authServer.close(resolve));
    fs.rmSync(authDirectory, { recursive: true, force: true });
  }
});

test('representative can sign in with a dedicated login ID and replace the initial password', async () => {
  const representative = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'parkjingam', password: 'demo1234' }) });
  assert.equal(representative.status, 200);
  assert.equal(representative.body.me.name, '박진감');
  assert.equal(representative.body.me.loginId, 'parkjingam');
  const changed = await request('/api/account/password', { method: 'POST', body: JSON.stringify({ currentPassword: 'demo1234', newPassword: 'representative-password-2026' }) }, representative.body.token);
  assert.equal(changed.status, 200);
  const nextLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'parkjingam', password: 'representative-password-2026' }) });
  assert.equal(nextLogin.status, 200);
});

test('a member can replace only their own profile photo and another tenant cannot read it', async () => {
  const memberToken = await login('member@workroom.demo');
  const form = new FormData();
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
  form.append('avatar', new Blob([png], { type: 'image/png' }), 'profile.png');
  const uploaded = await multipartRequest('/api/me/avatar', form, memberToken);
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.body.avatarUrl, '/api/avatars/member-1');
  const image = await fetch(`${base}${uploaded.body.avatarUrl}`, { headers: { authorization: `Bearer ${memberToken}` } });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  const otherToken = await login('other@workroom.demo');
  const blocked = await fetch(`${base}${uploaded.body.avatarUrl}`, { headers: { authorization: `Bearer ${otherToken}` } });
  assert.ok([403, 404].includes(blocked.status));
  const removed = await request('/api/me/avatar', { method: 'DELETE', body: '{}' }, memberToken);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.avatarUrl, '');
});

test('policy proposal framework and meeting photos remain tenant-scoped records', async () => {
  const rootToken = await login('root@workroom.demo');
  const created = await request('/api/proposals', { method: 'POST', body: JSON.stringify({ tenantId: 'tenant-2030', title: '프레임워크 보존 검증', topic: '참여·지역', dueAt: '2026-10-01', sections: { problem: '참여 경로가 분산되어 있다.', evidence: '합성 데모 근거.', proposal: '한 곳에서 안내한다.', implementation: '담당 부서가 갱신한다.', risks: '정보 최신성을 점검한다.' } }) }, rootToken);
  assert.equal(created.status, 201);
  assert.equal(created.body.dueAt, '2026-10-01');
  assert.equal(created.body.sections.proposal, '한 곳에서 안내한다.');

  const form = new FormData();
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
  form.append('photo', new Blob([png], { type: 'image/png' }), 'minutes.png'); form.append('caption', '합성 회의 사진');
  const uploaded = await multipartRequest('/api/meetings/meeting-1/minutes-photos', form, rootToken);
  assert.equal(uploaded.status, 201);
  assert.match(uploaded.body.url, /^\/api\/meeting-photos\/meeting-1\//);
  const image = await fetch(`${base}${uploaded.body.url}`, { headers: { authorization: `Bearer ${rootToken}` } });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  const otherToken = await login('other@workroom.demo');
  const blocked = await fetch(`${base}${uploaded.body.url}`, { headers: { authorization: `Bearer ${otherToken}` } });
  assert.ok([403, 404].includes(blocked.status));
});

test('chair can turn archived records into a tenant-scoped DOCX and printable PDF view', async () => {
  const rootToken = await login('root@workroom.demo');
  const activated = await request('/api/admin/tenants/tenant-2030', { method: 'PATCH', body: JSON.stringify({ active: true, serviceAccess: { plan: 'institutional_contract', status: 'active', startsAt: '2026-01-01', endsAt: '2027-12-31', supportLevel: 'standard' } }) }, rootToken);
  assert.equal(activated.status, 200);
  const permissions = await request('/api/tenant-governance', { method: 'PATCH', body: JSON.stringify({ tenantId: 'tenant-2030', rolePermissions: { chair: { manage: true, permissions: true, personalData: true, share: true } } }) }, rootToken);
  assert.equal(permissions.status, 200);
  const restoredChair = await request('/api/members/chair-1', { method: 'PATCH', body: JSON.stringify({ tenantId: 'tenant-2030', role: 'chair', active: true }) }, rootToken);
  assert.equal(restoredChair.status, 200);
  let chairLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'parkjingam', password: 'demo1234' }) });
  if (chairLogin.status === 401) chairLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'parkjingam', password: 'representative-password-2026' }) });
  assert.equal(chairLogin.status, 200);
  const chairToken = chairLogin.body.token;
  const createdRecord = await request('/api/archive-items', { method: 'POST', body: JSON.stringify({ title: '회의 결과 메모', category: '회의 자료', body: '정책제안 초안의 근거와 다음 행동을 정리했습니다.' }) }, chairToken);
  assert.equal(createdRecord.status, 201);
  const createdPackage = await request('/api/document-packages', { method: 'POST', body: JSON.stringify({ type: 'policy_delivery', title: '청년 주거 정책제안 전달문', recipient: '청년정책과', summary: '검토와 회신을 요청합니다.', sourceItemIds: [createdRecord.body.id] }) }, chairToken);
  assert.equal(createdPackage.status, 201, JSON.stringify(createdPackage.body));
  assert.equal(createdPackage.body.sources.length, 1);
  const docx = await fetch(`${base}/api/document-packages/${createdPackage.body.id}/docx`, { headers: { authorization: `Bearer ${chairToken}` } });
  assert.equal(docx.status, 200);
  assert.match(docx.headers.get('content-type'), /officedocument/);
  assert.equal((await docx.arrayBuffer()).byteLength > 4, true);
  const printable = await fetch(`${base}/api/document-packages/${createdPackage.body.id}/print`, { headers: { authorization: `Bearer ${chairToken}` } });
  assert.equal(printable.status, 200);
  assert.match(printable.headers.get('content-type'), /text\/html/);
  assert.match(await printable.text(), /청년 주거 정책제안 전달문/);
  const otherToken = await login('other@workroom.demo');
  const blocked = await fetch(`${base}/api/document-packages/${createdPackage.body.id}/docx`, { headers: { authorization: `Bearer ${otherToken}` } });
  assert.ok([403, 404].includes(blocked.status));
});

test('archive categories are seven tenant-scoped choices editable only by managers', async () => {
  const rootToken = await login('root@workroom.demo');
  const memberToken = await login('reviewer@workroom.demo');
  const otherToken = await login('other@workroom.demo');
  const bootstrap = await request('/api/bootstrap', {}, rootToken);
  const tenant = bootstrap.body.tenants.find((item) => item.id === 'tenant-2030');
  const categories = tenant.settings.archiveCategories;
  assert.equal(categories.length, 7);
  assert.deepEqual(new Set(categories.map((item) => item.color)), new Set(['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet']));

  const forbiddenSettings = await request('/api/archive-categories', { method: 'PATCH', body: JSON.stringify({ categories }) }, memberToken);
  assert.equal(forbiddenSettings.status, 403);
  const renamed = categories.map((item) => item.id === 'archive-category-red' ? { ...item, name: '핵심 결정' } : item);
  const saved = await request('/api/archive-categories', { method: 'PATCH', body: JSON.stringify({ tenantId: 'tenant-2030', categories: renamed }) }, rootToken);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.find((item) => item.id === 'archive-category-red').name, '핵심 결정');

  const changed = await request('/api/archive-dashboard-records/meeting/meeting-1', { method: 'PATCH', body: JSON.stringify({ tenantId: 'tenant-2030', categoryId: 'archive-category-red' }) }, rootToken);
  assert.equal(changed.status, 200);
  assert.equal(changed.body.categoryId, 'archive-category-red');
  const memberChange = await request('/api/archive-dashboard-records/meeting/meeting-1', { method: 'PATCH', body: JSON.stringify({ categoryId: 'archive-category-blue' }) }, memberToken);
  assert.equal(memberChange.status, 403);
  const crossTenantChange = await request('/api/archive-dashboard-records/meeting/meeting-1', { method: 'PATCH', body: JSON.stringify({ categoryId: 'archive-category-blue' }) }, otherToken);
  assert.equal(crossTenantChange.status, 403);
});

test('workroom records are automatically indexed as versioned files and can be exported', async () => {
  const rootToken = await login('root@workroom.demo');
  const bootstrap = await request('/api/bootstrap', {}, rootToken);
  assert.equal(bootstrap.status, 200);
  const recordFile = bootstrap.body.recordFiles.find((item) => item.source?.type === 'meeting');
  assert.ok(recordFile);
  assert.equal(recordFile.currentVersion >= 1, true);
  assert.equal(recordFile.versions[0].body.includes('회의 일시:'), true);
  const individualDocx = await fetch(`${base}/api/record-files/${recordFile.id}/docx`, { headers: { authorization: `Bearer ${rootToken}` } });
  assert.equal(individualDocx.status, 200);
  assert.match(individualDocx.headers.get('content-type'), /officedocument/);
  const packageResult = await request('/api/document-packages', { method: 'POST', body: JSON.stringify({ tenantId: 'tenant-2030', type: 'meeting_summary', title: '기록 파일 기반 회의 결과', sourceRecordIds: [recordFile.id] }) }, rootToken);
  assert.equal(packageResult.status, 201, JSON.stringify(packageResult.body));
  assert.equal(packageResult.body.sources[0].recordVersion >= 1, true);
  const otherToken = await login('other@workroom.demo');
  const denied = await fetch(`${base}/api/record-files/${recordFile.id}/docx`, { headers: { authorization: `Bearer ${otherToken}` } });
  assert.ok([403, 404].includes(denied.status));
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});
