import crypto from 'node:crypto';

const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');

const demoArchiveCategories = [
  ['red', '중요 결정'], ['orange', '회의 기록'], ['yellow', '정책 제안'], ['green', '운영 자료'], ['blue', '동향 자료'], ['indigo', '학습 자료'], ['violet', '인수인계'],
].map(([color, name]) => ({ id: `archive-category-${color}`, name, color }));

const demoTenantSettings = {
  ageBands: ['20–24', '25–29', '30–34', '35–39', '응답하지 않음'],
  divisions: ['일자리·경제', '주거·생활', '참여·지역'],
  managerName: '박진감',
  positionLabels: { chair: '위원장', vice_chair: '부위원장', secretary: '운영·간사', division_lead: '분과장', member: '일반위원' },
  rolePermissions: {
    chair: { manage: true, permissions: true, personalData: true, share: true }, vice_chair: { manage: true, permissions: false, personalData: false, share: true }, secretary: { manage: true, permissions: false, personalData: true, share: true }, division_lead: { manage: false, permissions: false, personalData: false, share: true }, member: { manage: false, permissions: false, personalData: false, share: false }, reviewer: { manage: false, permissions: false, personalData: false, share: false },
  },
  organizationProfile: { displayName: '행정안전부 2030자문단', shortName: '2030 자문단', institutionName: '행정안전부', institutionType: '중앙정부', representativeName: '박진감', representativeRole: '위원장', contactEmail: 'chair@workroom.demo', contactPhone: '02-2030-2030', ordinanceName: '「청년참여 활성화 조례」 (합성 예시)', ordinanceArticle: '제00조', termLabel: '2기', termStartsAt: '2026-07-01', termEndsAt: '2027-06-30', activityPeriod: '2026년 7월–2027년 6월', introduction: '청년의 생활 의제를 발굴하고 정책 제안과 후속 경과를 기록하는 합성 체험용 참여기구입니다.', logoText: '2030' },
  orgChart: { nodes: [
    { id: 'org-root-tenant-2030', name: '행정안전부 2030자문단', parentId: null, kind: '기구', createdAt: '2026-08-20T00:00:00.000Z' },
    { id: 'org-division-tenant-2030-1', name: '일자리·경제 분과', parentId: 'org-root-tenant-2030', kind: '분과', createdAt: '2026-08-20T00:00:00.000Z' },
    { id: 'org-division-tenant-2030-2', name: '주거·생활 분과', parentId: 'org-root-tenant-2030', kind: '분과', createdAt: '2026-08-20T00:00:00.000Z' },
    { id: 'org-division-tenant-2030-3', name: '참여·지역 TF', parentId: 'org-root-tenant-2030', kind: 'TF', createdAt: '2026-08-20T00:00:00.000Z' },
  ], history: [], updatedAt: '2026-08-20T00:00:00.000Z' },
  archiveCategories: demoArchiveCategories,
};

const user = (id, name, email, role, tenantId, extra = {}) => {
  const salt = `demo-${id}-salt`;
  return {
    id, name, email, role, tenantId, active: true, term: '2기',
    ageBand: '25–29', job: '청년정책 활동가', region: '서울 성동구',
    passwordSalt: salt, passwordHash: hashPassword('demo1234', salt), ...extra,
  };
};

export const createSeed = () => ({
  meta: { version: 1, seededAt: '2026-08-20T00:00:00.000Z' },
  tenants: [
    { id: 'tenant-2030', name: '행정안전부 2030자문단 (시뮬레이션)', cohort: '2기', capacity: 20, active: true, operator: '박진감', featureFlags: { community: true, aiAssistant: true, researchExport: true }, serviceAccess: { plan: 'template_experience', status: 'demo', dataMode: 'synthetic_demo', seatLimit: 20, supportLevel: 'none', note: '기능 검증용 합성 데모입니다. 실제 무료 운영을 뜻하지 않습니다.' }, settings: demoTenantSettings, createdAt: '2026-08-20T00:00:00.000Z' },
    { id: 'tenant-sandbox', name: '타 지역 청년참여기구 (격리 검증용)', cohort: '1기', capacity: 12, active: true, operator: '박진감', featureFlags: { community: true, aiAssistant: false, researchExport: false }, serviceAccess: { plan: 'template_experience', status: 'demo', dataMode: 'synthetic_demo', seatLimit: 12, supportLevel: 'none', note: '테넌트 격리 검증용 합성 데모입니다.' }, createdAt: '2026-08-20T00:00:00.000Z' },
  ],
  users: [
    user('root-1', '박진감', 'root@workroom.demo', 'platform_admin', null, { ageBand: '30–34', job: '운영자', region: '서울 성동구' }),
    user('sec-1', '윤서진', 'secretary@workroom.demo', 'secretary', 'tenant-2030', { ageBand: '30–34', job: '자문단 간사' }),
    user('chair-1', '박진감', 'chair@workroom.demo', 'chair', 'tenant-2030', { loginId: 'parkjingam', passwordChangeRequired: true, ageBand: '30–34', job: '청년정책 활동가·위원장' }),
    user('vice-1', '김도윤', 'vicechair@workroom.demo', 'vice_chair', 'tenant-2030', { ageBand: '30–34', job: '지역 협력 활동가', orgAssignments: [{ nodeId: 'org-division-tenant-2030-3', position: '부위원장' }] }),
    user('lead-1', '서윤아', 'lead@workroom.demo', 'division_lead', 'tenant-2030', { ageBand: '25–29', job: '청년공간 매니저', orgAssignments: [{ nodeId: 'org-division-tenant-2030-2', position: '분과장' }] }),
    user('member-1', '이하늘', 'member@workroom.demo', 'member', 'tenant-2030', { ageBand: '25–29', job: '직장인' }),
    user('review-1', '정민아', 'reviewer@workroom.demo', 'reviewer', 'tenant-2030', { ageBand: '35–39', job: '정책 컨설턴트', assignedProposalIds: ['proposal-housing'] }),
    user('other-1', '최다온', 'other@workroom.demo', 'member', 'tenant-sandbox', { ageBand: '20–24', job: '대학생', region: '대전 중구' }),
  ],
  issues: [
    { id: 'issue-housing', tenantId: 'tenant-2030', title: '청년 주거비 부담과 지역 간 지원 격차', sourceUrl: 'https://example.org/official-housing', sourceName: '공식 자료 예시', checkedAt: '2026-08-19', editorNote: '합성 데모 이슈입니다. 실제 정책 사실로 인용하지 마세요.', visibility: 'tenant', archiveCategoryId: 'archive-category-blue', createdBy: 'sec-1', createdAt: '2026-08-20T08:00:00.000Z' },
    { id: 'issue-work', tenantId: 'tenant-2030', title: '초기 경력 청년의 지역 일자리 정보 접근', sourceUrl: 'https://example.org/official-work', sourceName: '공식 자료 예시', checkedAt: '2026-08-18', editorNote: '토론을 위한 합성 예시입니다.', visibility: 'tenant', archiveCategoryId: 'archive-category-blue', createdBy: 'sec-1', createdAt: '2026-08-20T08:05:00.000Z' },
    { id: 'issue-region', tenantId: 'tenant-2030', title: '청년 참여기구의 지역 간 연결 방식', sourceUrl: 'https://example.org/official-participation', sourceName: '공식 자료 예시', checkedAt: '2026-08-17', editorNote: '협업 의제 검토용 합성 예시입니다.', visibility: 'tenant', archiveCategoryId: 'archive-category-blue', createdBy: 'sec-1', createdAt: '2026-08-20T08:10:00.000Z' },
  ],
  announcements: [
    { id: 'notice-1', tenantId: 'tenant-2030', title: '8월 정기회의 사전 자료를 확인해 주세요', body: '안건별 자료를 읽고 참석 여부를 회의 전날까지 응답해 주세요.', target: 'all', createdBy: 'sec-1', createdAt: '2026-08-20T08:15:00.000Z' },
  ],
  meetings: [
    { id: 'meeting-0', tenantId: 'tenant-2030', title: '2기 제2차 정기회의', type: '정기회의', startsAt: '2026-08-12T19:00', location: '온라인 회의실', agenda: [{ id: 'agenda-0', title: '청년 주거 이슈의 정책 제안 방향', issueId: 'issue-housing', status: 'completed' }], materials: ['2차 회의 사전자료.pdf'], minutes: '합성 데모 회의록: 지역별 청년 주거 정보의 접근 경로를 비교하고, 제안서에 현장 이용 경험을 함께 담기로 했습니다.', decisions: [{ id: 'decision-0', text: '주거 의제의 현장 근거를 수집한다.', ownerId: 'member-1', dueAt: '2026-08-22', status: 'completed' }], attendance: { 'sec-1': 'attending', 'chair-1': 'attending', 'member-1': 'attending', 'review-1': 'absent' }, archiveCategoryId: 'archive-category-orange', createdBy: 'sec-1', createdAt: '2026-08-05T08:20:00.000Z' },
    { id: 'meeting-1', tenantId: 'tenant-2030', title: '2기 제3차 정기회의', type: '정기회의', startsAt: '2026-08-28T10:00', location: '온라인 회의실', agenda: [{ id: 'agenda-1', title: '청년 주거 지원의 지역 격차', issueId: 'issue-housing', status: 'discussing' }], materials: ['주거 이슈 브리핑.pdf'], minutes: '합성 데모 회의록: 지역별 지원 정보 접근성과 상담 창구의 차이를 추가 확인하기로 함.', decisions: [{ id: 'decision-1', text: '주거 분과가 정책제안 초안을 작성한다.', ownerId: 'member-1', dueAt: '2026-09-03', status: 'open' }], attendance: { 'sec-1': 'attending', 'chair-1': 'attending', 'member-1': 'undecided', 'review-1': 'not_invited' }, archiveCategoryId: 'archive-category-red', createdBy: 'sec-1', createdAt: '2026-08-20T08:20:00.000Z' },
    { id: 'meeting-2', tenantId: 'tenant-2030', title: '주거 분과회의', type: '분과회의', startsAt: '2026-09-02T19:00', location: '성동구 청년공간(예시)', agenda: [{ id: 'agenda-2', title: '제안서 근거와 반론 검토', issueId: 'issue-housing', status: 'planned' }], materials: [], minutes: '', decisions: [], attendance: { 'chair-1': 'attending', 'member-1': 'attending' }, archiveCategoryId: 'archive-category-orange', createdBy: 'chair-1', createdAt: '2026-08-20T08:25:00.000Z' },
    { id: 'meeting-3', tenantId: 'tenant-2030', title: '정책 제안 분과회의', type: '분과회의', startsAt: '2026-09-18T19:00', location: '온라인 회의실', agenda: [{ id: 'agenda-3', title: '주거 정책제안 초안 검토', issueId: 'issue-housing', status: 'planned' }], materials: ['정책제안 초안.pdf'], minutes: '', decisions: [], attendance: {}, rsvp: { 'chair-1': 'attending', 'vice-1': 'attending', 'lead-1': 'undecided', 'member-1': 'absent' }, participantIds: ['chair-1', 'vice-1', 'lead-1', 'member-1'], archiveCategoryId: 'archive-category-yellow', createdBy: 'chair-1', createdAt: '2026-09-07T08:30:00.000Z', status: 'scheduled' },
    { id: 'meeting-4', tenantId: 'tenant-2030', title: '2기 제4차 정기회의', type: '정기회의', startsAt: '2026-10-15T19:00', location: '온라인 회의실', agenda: [{ id: 'agenda-4', title: '정책제안 제출 전 최종 검토', issueId: 'issue-housing', status: 'planned' }], materials: [], minutes: '', decisions: [], attendance: {}, rsvp: { 'sec-1': 'attending', 'chair-1': 'attending', 'vice-1': 'absent', 'lead-1': 'undecided', 'member-1': 'undecided', 'review-1': 'undecided' }, participantIds: ['sec-1', 'chair-1', 'vice-1', 'lead-1', 'member-1', 'review-1'], archiveCategoryId: 'archive-category-orange', createdBy: 'sec-1', createdAt: '2026-09-07T08:35:00.000Z', status: 'scheduled' },
  ],
  proposals: [
    { id: 'proposal-housing', tenantId: 'tenant-2030', title: '청년 주거지원 정보·상담의 지역 격차 완화', topic: '주거·생활', dueAt: '2026-09-12', status: 'consulting', issueId: 'issue-housing', ownerId: 'member-1', contributors: ['chair-1', 'member-1'], archiveCategoryId: 'archive-category-yellow', sections: { problem: '지역마다 청년이 이용할 수 있는 주거 지원 정보와 상담 경로가 달라, 필요한 제도를 찾는 비용이 커질 수 있다.', evidence: '합성 데모 근거: 이용자 경험과 공개 정보의 접근 경로를 비교해 추가 확인한다.', proposal: '지역별 정보와 상담 경로를 한 화면에서 안내하고, 미연결 지역의 담당 부서를 명시한다.', implementation: '지자체 청년정책 부서와 청년공간이 안내 기준을 공동 관리한다.', risks: '정보 최신성 유지 비용과 각 지역 사업의 차이를 함께 검토한다.' }, versions: [{ id: 'version-1', label: 'v0.3', note: '컨설팅 요청본', createdBy: 'member-1', createdAt: '2026-08-20T08:30:00.000Z' }], feedback: [{ id: 'feedback-1', section: 'evidence', type: '근거 보강', body: '지역별 차이를 보여 줄 비교 기준과 확인일을 명시해 주세요.', authorId: 'review-1', status: 'open', createdAt: '2026-08-20T08:35:00.000Z' }], consultation: { requestedAt: '2026-08-20T08:30:00.000Z', requestedBy: 'member-1', reviewerId: 'review-1', scope: '근거 구조와 실행 주체 검토', status: 'in_progress' }, institutionDelivery: { status: 'sent', message: '현장 근거를 보완한 뒤 기관 운영팀의 확인을 요청합니다.', submittedBy: 'member-1', submittedAt: '2026-08-20T09:10:00.000Z', receivedBy: null, receivedAt: null, response: null }, finalSubmission: null, progress: [], createdAt: '2026-08-20T08:25:00.000Z', updatedAt: '2026-08-20T09:10:00.000Z' },
    { id: 'proposal-job', tenantId: 'tenant-2030', title: '지역 청년 일자리 정보 접근성 개선', topic: '일자리·경제', dueAt: '2026-09-25', status: 'submitted', issueId: 'issue-work', ownerId: 'chair-1', contributors: ['chair-1'], archiveCategoryId: 'archive-category-green', sections: { problem: '초기 경력 청년이 지역별 채용·지원 정보를 비교하기 어렵다.', evidence: '합성 데모 근거.', proposal: '지역 청년공간의 공통 안내 항목을 정한다.', implementation: '청년정책 부서와 청년공간 협업.', risks: '기존 채널과의 중복을 점검.' }, versions: [{ id: 'version-2', label: '최종 제출본', note: 'PDF 제출 기록', createdBy: 'chair-1', createdAt: '2026-08-18T09:00:00.000Z' }], feedback: [], consultation: null, finalSubmission: { submittedAt: '2026-08-18T10:00:00.000Z', destination: '정책 담당 부서(합성)', fileName: '지역-청년일자리-제안서.pdf', hash: 'demo-sha256-8f43e', recordedBy: 'chair-1' }, progress: [{ id: 'progress-1', body: '담당 부서의 검토 회신을 기다리는 상태입니다.', status: 'awaiting_response', createdBy: 'sec-1', createdAt: '2026-08-19T08:00:00.000Z' }], createdAt: '2026-08-10T08:00:00.000Z', updatedAt: '2026-08-19T08:00:00.000Z' },
  ],
  archiveItems: [
    { id: 'archive-1', tenantId: 'tenant-2030', title: '1기 활동 인수인계 메모', category: '인수인계', categoryId: 'archive-category-violet', body: '합성 데모 자료: 다음 기수에 남길 의제 배경과 미해결 질문.', visibility: 'tenant', createdBy: 'sec-1', createdAt: '2026-08-20T08:00:00.000Z' },
    { id: 'archive-2', tenantId: 'tenant-2030', title: '지역 청년참여 온라인 간담회 운영 사례', category: '운영 자료', categoryId: 'archive-category-green', body: '공개 동의가 완료된 합성 사례입니다.', visibility: 'approved_public', createdBy: 'sec-1', createdAt: '2026-08-20T08:00:00.000Z' },
    { id: 'archive-3', tenantId: 'tenant-2030', title: '지역 청년정책 학습 자료', category: '학습 자료', categoryId: 'archive-category-indigo', body: '다음 회의에서 비교할 청년정책 자료의 읽기 메모입니다.', visibility: 'tenant', createdBy: 'lead-1', createdAt: '2026-08-21T08:00:00.000Z' },
  ],
  tenantTemplates: [
    { id: 'template-standard', name: '표준 청년참여기구', description: '정기회의·분과·정책제안·아카이브를 포함하는 기본 템플릿', roles: ['chair', 'vice_chair', 'secretary', 'division_lead', 'member', 'reviewer'], ageBands: ['20–24', '25–29', '30–34', '35–39', '응답하지 않음'], divisions: ['일자리·경제', '주거·생활', '참여·지역'], createdAt: '2026-08-20T00:00:00.000Z' },
    { id: 'template-light', name: '소규모 자문단', description: '회의·의견 수렴·제안서 검토를 중심으로 한 간결한 템플릿', roles: ['secretary', 'chair', 'member'], ageBands: ['20–29', '30–39', '응답하지 않음'], divisions: ['자유 의제'], createdAt: '2026-08-20T00:00:00.000Z' },
  ],
  contentReviews: [
    { id: 'content-review-1', tenantId: 'tenant-2030', contentType: 'issue', contentId: 'issue-housing', title: '청년 주거비 부담과 지역 간 지원 격차', status: 'published', visibility: 'tenant', reviewerId: 'root-1', createdAt: '2026-08-20T08:00:00.000Z', reviewedAt: '2026-08-20T09:00:00.000Z' },
    { id: 'content-review-2', tenantId: 'tenant-2030', contentType: 'announcement', contentId: 'notice-1', title: '8월 정기회의 사전 자료를 확인해 주세요', status: 'reviewing', visibility: 'tenant', reviewerId: null, createdAt: '2026-08-20T08:15:00.000Z', reviewedAt: null },
  ],
  consultationAssignments: [
    { id: 'assignment-1', tenantId: 'tenant-2030', proposalId: 'proposal-housing', reviewerId: 'review-1', status: 'in_progress', dueAt: '2026-08-29', createdAt: '2026-08-20T08:30:00.000Z' },
    { id: 'assignment-2', tenantId: 'tenant-2030', proposalId: 'proposal-job', reviewerId: null, status: 'awaiting_assignment', dueAt: null, createdAt: '2026-08-20T08:00:00.000Z' },
  ],
  casePublicationRequests: [
    { id: 'case-request-1', tenantId: 'tenant-2030', archiveItemId: 'archive-2', title: '지역 청년참여 온라인 간담회 운영 사례', authorConsent: 'granted', operatorApproval: 'pending', visibility: 'operator_review', createdAt: '2026-08-20T08:00:00.000Z' },
    { id: 'case-request-2', tenantId: 'tenant-2030', archiveItemId: 'archive-1', title: '1기 활동 인수인계 메모', authorConsent: 'not_requested', operatorApproval: 'not_started', visibility: 'tenant', createdAt: '2026-08-20T08:00:00.000Z' },
  ],
  researchRequests: [
    { id: 'research-1', title: '주거 의제 제안서의 근거 보강 패턴', purpose: '연차 활동 보고서의 내부 검토', variables: ['의제', '상태', '피드백 유형'], status: 'approval_pending', requestedBy: 'root-1', approverId: null, expiresAt: '2026-09-30', createdAt: '2026-08-20T10:00:00.000Z' },
  ],
  consentVersions: [
    { id: 'consent-1', name: '서비스 이용 동의', version: 'v0.1', status: 'draft', effectiveAt: null, updatedAt: '2026-08-20T00:00:00.000Z' },
    { id: 'consent-2', name: '사례 공개 동의', version: 'v0.1', status: 'draft', effectiveAt: null, updatedAt: '2026-08-20T00:00:00.000Z' },
  ],
  retentionPolicies: [
    { id: 'retention-1', scope: '회의·제안서 기록', status: 'needs_contract_review', proposedPeriod: '기관별 운영규정 확인 전', owner: '운영사', updatedAt: '2026-08-20T00:00:00.000Z' },
    { id: 'retention-2', scope: '삭제·처리정지 요청', status: 'flow_ready', proposedPeriod: '실제 처리 절차 확정 필요', owner: '운영사', updatedAt: '2026-08-20T00:00:00.000Z' },
  ],
  systemNotices: [
    { id: 'system-1', title: '실제 개인정보 입력 금지', body: '현재 환경은 합성 데이터 기반 MVP입니다.', level: 'notice', status: 'active', createdAt: '2026-08-20T00:00:00.000Z' },
  ],
  communityPosts: [
    { id: 'community-1', tenantId: 'tenant-2030', title: '다른 지역 참여기구와 주거 의제 간담회를 제안합니다', body: '정책제안의 근거와 전달 방식을 함께 나눌 기구를 찾습니다.', kind: 'collaboration', visibility: 'approved_public', status: 'open', authorId: 'chair-1', createdAt: '2026-08-20T09:00:00.000Z', replies: [] },
  ],
  deletionRequests: [],
  notifications: [
    { id: 'notice-delivery-chair', userId: 'chair-1', tenantId: 'tenant-2030', kind: 'proposal_delivered', title: '청년 활동가가 정책제안을 전달했습니다', body: '청년 주거지원 정보·상담의 지역 격차 완화', proposalId: 'proposal-housing', createdAt: '2026-08-20T09:10:00.000Z', readAt: null },
    { id: 'notice-delivery-secretary', userId: 'sec-1', tenantId: 'tenant-2030', kind: 'proposal_delivered', title: '청년 활동가가 정책제안을 전달했습니다', body: '청년 주거지원 정보·상담의 지역 격차 완화', proposalId: 'proposal-housing', createdAt: '2026-08-20T09:10:00.000Z', readAt: null },
  ],
  auditLogs: [],
  sessions: [],
  oauthStates: [],
});

export const verifyPassword = (password, userRecord) => hashPassword(password, userRecord.passwordSalt) === userRecord.passwordHash;
