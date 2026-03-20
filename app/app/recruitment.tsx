import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Spacing, BorderRadius, AppColors, CardShadow } from '@/constants/theme';
import api from '@/lib/api';
import * as DocumentPicker from 'expo-document-picker';

// ─── Constants (match web) ─────────────────────────────────────────────
const JOB_STATUS = [
  { value: 'DRAFT', label: 'Draft', bg: '#f3f4f6', color: '#6b7280' },
  { value: 'OPEN', label: 'Open', bg: '#dbeafe', color: '#2563eb' },
  { value: 'ON_HOLD', label: 'On Hold', bg: '#fef3c7', color: '#b45309' },
  { value: 'CLOSED', label: 'Closed', bg: '#fee2e2', color: '#b91c1c' },
];

const EMP_TYPE = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'OTHER', label: 'Other' },
];

const APP_STATUS = [
  { value: 'APPLIED', label: 'Applied', bg: '#dbeafe', color: '#2563eb' },
  { value: 'SCREENING', label: 'Screening', bg: '#e0e7ff', color: '#4338ca' },
  { value: 'SHORTLISTED', label: 'Shortlisted', bg: '#fef3c7', color: '#b45309' },
  { value: 'INTERVIEW', label: 'Interview', bg: '#fed7aa', color: '#c2410c' },
  { value: 'OFFER', label: 'Offer', bg: '#bbf7d0', color: '#15803d' },
  { value: 'HIRED', label: 'Hired', bg: '#22c55e', color: '#fff' },
  { value: 'REJECTED', label: 'Rejected', bg: '#fecaca', color: '#b91c1c' },
  { value: 'WITHDRAWN', label: 'Withdrawn', bg: '#f3f4f6', color: '#6b7280' },
];

const PIPELINE_STAGES = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED'];
const OUT_STAGES = ['REJECTED', 'WITHDRAWN'];

const SOURCES = [
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'JOB_PORTAL', label: 'Job Portal' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'DIRECT', label: 'Direct' },
  { value: 'CAMPUS', label: 'Campus' },
  { value: 'AGENCY', label: 'Agency' },
  { value: 'OTHER', label: 'Other' },
];

function getNextStages(current: string): string[] {
  const idx = PIPELINE_STAGES.indexOf(current);
  if (idx === -1) return [];
  return [...PIPELINE_STAGES.slice(idx + 1), ...OUT_STAGES];
}

function fmt(d: string | Date | undefined): string {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}
function fmtInput(d: string | Date | undefined): string {
  return d ? new Date(d).toISOString().split('T')[0] : '';
}

// ─── Types ─────────────────────────────────────────────────────────────
type Department = { _id: string; name: string };
type User = { _id: string; name: string; employeeId?: string };

type Job = {
  _id: string;
  title?: string;
  description?: string;
  status?: string;
  employmentType?: string;
  noOfPositions?: number;
  applicationCount?: number;
  hiredCount?: number;
  department?: Department | string;
  hiringManager?: User | string;
  location?: string;
  requirements?: string;
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  closingDate?: string;
  createdAt?: string;
};

type Application = {
  _id: string;
  job?: { _id: string; title?: string; department?: { _id: string }; status?: string };
  candidateName?: string;
  email?: string;
  phone?: string;
  status?: string;
  source?: string;
  currentCompany?: string;
  experienceYears?: number;
  expectedSalary?: number;
  noticePeriod?: string;
  notes?: string;
  rating?: number;
  interviewDate?: string;
  interviewFeedback?: string;
  offeredSalary?: number;
  rejectedReason?: string;
  hiredAt?: string;
  resumeUrl?: string;
  offerLetterUrl?: string;
  createdEmployee?: { _id: string; name: string; employeeId?: string };
  createdAt?: string;
};

type Stats = { openJobs?: number; totalApplications?: number; byStatus?: Record<string, number> };

// ─── Job form modal ────────────────────────────────────────────────────
function JobFormModal({
  job,
  departments,
  managers,
  onClose,
  onSaved,
  showMsg,
}: {
  job: Job | null;
  departments: Department[];
  managers: User[];
  onClose: () => void;
  onSaved: () => void;
  showMsg: (m: string) => void;
}) {
  const isEdit = !!job;
  const [title, setTitle] = useState(job?.title ?? '');
  const [description, setDescription] = useState(job?.description ?? '');
  const [department, setDepartment] = useState((job?.department as { _id?: string })?._id ?? (typeof job?.department === 'string' ? job.department : '') ?? '');
  const [location, setLocation] = useState(job?.location ?? '');
  const [employmentType, setEmploymentType] = useState(job?.employmentType ?? 'FULL_TIME');
  const [noOfPositions, setNoOfPositions] = useState(String(job?.noOfPositions ?? 1));
  const [requirements, setRequirements] = useState(job?.requirements ?? '');
  const [salaryRangeMin, setSalaryRangeMin] = useState(job?.salaryRangeMin != null ? String(job.salaryRangeMin) : '');
  const [salaryRangeMax, setSalaryRangeMax] = useState(job?.salaryRangeMax != null ? String(job.salaryRangeMax) : '');
  const [status, setStatus] = useState(job?.status ?? 'DRAFT');
  const [closingDate, setClosingDate] = useState(fmtInput(job?.closingDate) ?? '');
  const [hiringManager, setHiringManager] = useState((job?.hiringManager as User)?._id ?? (typeof job?.hiringManager === 'string' ? job.hiringManager : '') ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return showMsg('Title is required.');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        department: department || undefined,
        location: location.trim(),
        employmentType,
        noOfPositions: Math.max(1, parseInt(noOfPositions, 10) || 1),
        requirements: requirements.trim(),
        status,
        closingDate: closingDate || undefined,
        hiringManager: hiringManager || undefined,
      };
      if (salaryRangeMin !== '') payload.salaryRangeMin = Number(salaryRangeMin);
      if (salaryRangeMax !== '') payload.salaryRangeMax = Number(salaryRangeMax);
      if (isEdit && job) {
        await api.patch(`/ats/jobs/${job._id}`, payload);
        showMsg('Job updated.');
      } else {
        await api.post('/ats/jobs', payload);
        showMsg('Job created.');
      }
      onSaved();
    } catch (err: unknown) {
      showMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={modalStyles.overlay}>
        <View style={modalStyles.box}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{isEdit ? 'Edit Job' : 'New Job Opening'}</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={modalStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.label}>Title *</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Senior Software Engineer" style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Department</Text>
            <View style={modalStyles.pickerWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity style={[modalStyles.chip, !department && modalStyles.chipActive]} onPress={() => setDepartment('')}>
                  <Text style={[modalStyles.chipText, !department && modalStyles.chipTextActive]}>—</Text>
                </TouchableOpacity>
                {departments.map((d) => (
                  <TouchableOpacity key={d._id} style={[modalStyles.chip, department === d._id && modalStyles.chipActive]} onPress={() => setDepartment(d._id)}>
                    <Text style={[modalStyles.chipText, department === d._id && modalStyles.chipTextActive]}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={modalStyles.label}>Location</Text>
            <TextInput value={location} onChangeText={setLocation} placeholder="City / Remote" style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Employment Type</Text>
            <View style={modalStyles.rowWrap}>
              {EMP_TYPE.map((e) => (
                <TouchableOpacity key={e.value} style={[modalStyles.chip, employmentType === e.value && modalStyles.chipActive]} onPress={() => setEmploymentType(e.value)}>
                  <Text style={[modalStyles.chipText, employmentType === e.value && modalStyles.chipTextActive]}>{e.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={modalStyles.label}>No. of Positions</Text>
            <TextInput value={noOfPositions} onChangeText={setNoOfPositions} keyboardType="number-pad" style={modalStyles.input} />
            <Text style={modalStyles.label}>Status</Text>
            <View style={modalStyles.rowWrap}>
              {JOB_STATUS.map((s) => (
                <TouchableOpacity key={s.value} style={[modalStyles.chip, status === s.value && modalStyles.chipActive]} onPress={() => setStatus(s.value)}>
                  <Text style={[modalStyles.chipText, status === s.value && modalStyles.chipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={modalStyles.label}>Closing Date (YYYY-MM-DD)</Text>
            <TextInput value={closingDate} onChangeText={setClosingDate} placeholder="2025-12-31" style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Hiring Manager</Text>
            <View style={modalStyles.pickerWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity style={[modalStyles.chip, !hiringManager && modalStyles.chipActive]} onPress={() => setHiringManager('')}>
                  <Text style={[modalStyles.chipText, !hiringManager && modalStyles.chipTextActive]}>—</Text>
                </TouchableOpacity>
                {managers.map((m) => (
                  <TouchableOpacity key={m._id} style={[modalStyles.chip, hiringManager === m._id && modalStyles.chipActive]} onPress={() => setHiringManager(m._id)}>
                    <Text style={[modalStyles.chipText, hiringManager === m._id && modalStyles.chipTextActive]} numberOfLines={1}>{m.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={modalStyles.label}>Salary Min (₹) / Max (₹)</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextInput value={salaryRangeMin} onChangeText={setSalaryRangeMin} keyboardType="number-pad" placeholder="LPA" style={[modalStyles.input, { flex: 1 }]} placeholderTextColor={AppColors.textSecondary} />
              <TextInput value={salaryRangeMax} onChangeText={setSalaryRangeMax} keyboardType="number-pad" placeholder="LPA" style={[modalStyles.input, { flex: 1 }]} placeholderTextColor={AppColors.textSecondary} />
            </View>
            <Text style={modalStyles.label}>Description</Text>
            <TextInput value={description} onChangeText={setDescription} multiline numberOfLines={3} style={[modalStyles.input, modalStyles.textArea]} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Requirements</Text>
            <TextInput value={requirements} onChangeText={setRequirements} multiline numberOfLines={2} style={[modalStyles.input, modalStyles.textArea]} placeholderTextColor={AppColors.textSecondary} />
            <TouchableOpacity onPress={submit} disabled={saving} style={[modalStyles.saveBtn, saving && modalStyles.saveBtnDisabled]}>
              <Text style={modalStyles.saveBtnText}>{saving ? 'Saving…' : isEdit ? 'Update Job' : 'Create Job'}</Text>
            </TouchableOpacity>
            <View style={{ height: Spacing.section }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Add Application modal ──────────────────────────────────────────────
function AddApplicationModal({
  jobId,
  onClose,
  onSaved,
  showMsg,
}: {
  jobId: string;
  onClose: () => void;
  onSaved: () => void;
  showMsg: (m: string) => void;
}) {
  const [candidateName, setCandidateName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('DIRECT');
  const [currentCompany, setCurrentCompany] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [notes, setNotes] = useState('');
  const [resumeFile, setResumeFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled) setResumeFile(result.assets[0]);
    } catch {
      showMsg('Could not pick file.');
    }
  };

  const submit = async () => {
    if (!candidateName.trim() || !email.trim()) return showMsg('Name and email are required.');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('candidateName', candidateName.trim());
      fd.append('email', email.trim());
      fd.append('phone', phone.trim());
      fd.append('source', source);
      fd.append('currentCompany', currentCompany.trim());
      if (experienceYears !== '') fd.append('experienceYears', experienceYears);
      if (expectedSalary !== '') fd.append('expectedSalary', expectedSalary);
      fd.append('noticePeriod', noticePeriod.trim());
      fd.append('notes', notes.trim());
      if (resumeFile) {
        const uri = resumeFile.uri;
        fd.append('resume', {
          uri: Platform.OS === 'android' && !uri.startsWith('file://') ? `file://${uri}` : uri,
          name: resumeFile.name ?? 'resume',
          type: resumeFile.mimeType ?? 'application/octet-stream',
        } as unknown as Blob);
      }
      await api.post(`/ats/jobs/${jobId}/applications`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showMsg('Application added.');
      onSaved();
    } catch (err: unknown) {
      showMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={modalStyles.overlay}>
        <View style={modalStyles.box}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Add Candidate</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={modalStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.label}>Name *</Text>
            <TextInput value={candidateName} onChangeText={setCandidateName} style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Email *</Text>
            <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Phone</Text>
            <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Source</Text>
            <View style={modalStyles.rowWrap}>
              {SOURCES.map((s) => (
                <TouchableOpacity key={s.value} style={[modalStyles.chip, source === s.value && modalStyles.chipActive]} onPress={() => setSource(s.value)}>
                  <Text style={[modalStyles.chipText, source === s.value && modalStyles.chipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={modalStyles.label}>Current Company</Text>
            <TextInput value={currentCompany} onChangeText={setCurrentCompany} style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Exp (years) / Expected Salary (₹)</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextInput value={experienceYears} onChangeText={setExperienceYears} keyboardType="number-pad" style={[modalStyles.input, { flex: 1 }]} placeholderTextColor={AppColors.textSecondary} />
              <TextInput value={expectedSalary} onChangeText={setExpectedSalary} keyboardType="number-pad" style={[modalStyles.input, { flex: 1 }]} placeholderTextColor={AppColors.textSecondary} />
            </View>
            <Text style={modalStyles.label}>Notice Period</Text>
            <TextInput value={noticePeriod} onChangeText={setNoticePeriod} placeholder="e.g. 2 weeks" style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Resume (PDF/DOC)</Text>
            <TouchableOpacity onPress={pickResume} style={modalStyles.fileBtn}>
              <Text style={modalStyles.fileBtnText}>{resumeFile ? resumeFile.name ?? 'Selected' : 'Pick file'}</Text>
            </TouchableOpacity>
            <Text style={modalStyles.label}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} multiline numberOfLines={2} style={[modalStyles.input, modalStyles.textArea]} placeholderTextColor={AppColors.textSecondary} />
            <TouchableOpacity onPress={submit} disabled={submitting} style={[modalStyles.saveBtn, submitting && modalStyles.saveBtnDisabled]}>
              <Text style={modalStyles.saveBtnText}>{submitting ? 'Adding…' : 'Add Application'}</Text>
            </TouchableOpacity>
            <View style={{ height: Spacing.section }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Application detail modal (edit, move, offer upload, create employee, delete) ───
function ApplicationDetailModal({
  application,
  onClose,
  onUpdated,
  showMsg,
}: {
  application: Application | null;
  onClose: () => void;
  onUpdated: () => void;
  showMsg: (m: string) => void;
}) {
  const [status, setStatus] = useState(application?.status ?? 'APPLIED');
  const [notes, setNotes] = useState(application?.notes ?? '');
  const [rating, setRating] = useState(application?.rating != null ? String(application.rating) : '');
  const [interviewDate, setInterviewDate] = useState(fmtInput(application?.interviewDate) ?? '');
  const [interviewFeedback, setInterviewFeedback] = useState(application?.interviewFeedback ?? '');
  const [offeredSalary, setOfferedSalary] = useState(application?.offeredSalary != null ? String(application.offeredSalary) : '');
  const [rejectedReason, setRejectedReason] = useState(application?.rejectedReason ?? '');
  const [hiredAt, setHiredAt] = useState(fmtInput(application?.hiredAt) ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingOffer, setUploadingOffer] = useState(false);
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [createResult, setCreateResult] = useState<{ tempPassword?: string } | null>(null);

  useEffect(() => {
    if (!application) return;
    setStatus(application.status ?? 'APPLIED');
    setNotes(application.notes ?? '');
    setRating(application.rating != null ? String(application.rating) : '');
    setInterviewDate(fmtInput(application.interviewDate) ?? '');
    setInterviewFeedback(application.interviewFeedback ?? '');
    setOfferedSalary(application.offeredSalary != null ? String(application.offeredSalary) : '');
    setRejectedReason(application.rejectedReason ?? '');
    setHiredAt(fmtInput(application.hiredAt) ?? '');
  }, [application]);

  const save = async () => {
    if (!application) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        status,
        notes: notes.trim() || undefined,
        rating: rating === '' ? undefined : Number(rating),
        interviewDate: interviewDate || undefined,
        interviewFeedback: interviewFeedback.trim() || undefined,
        offeredSalary: offeredSalary === '' ? undefined : Number(offeredSalary),
        rejectedReason: rejectedReason.trim() || undefined,
      };
      if (hiredAt) payload.hiredAt = hiredAt;
      if (status === 'HIRED' && !hiredAt) payload.hiredAt = new Date().toISOString().split('T')[0];
      await api.patch(`/ats/applications/${application._id}`, payload);
      showMsg('Application updated.');
      onUpdated();
      onClose();
    } catch (err: unknown) {
      showMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const uploadOfferLetter = async () => {
    if (!application) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setUploadingOffer(true);
      const fd = new FormData();
      const f = result.assets[0];
      const uri = f.uri;
      fd.append('file', {
        uri: Platform.OS === 'android' && !uri.startsWith('file://') ? `file://${uri}` : uri,
        name: f.name ?? 'offer',
        type: f.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
      await api.post(`/ats/applications/${application._id}/offer-letter`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showMsg('Offer letter uploaded.');
      onUpdated();
    } catch (err: unknown) {
      showMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed.');
    } finally {
      setUploadingOffer(false);
    }
  };

  const createEmployee = () => {
    if (!application) return;
    Alert.alert(
      'Create Employee',
      'Create an employee account for this candidate? They will get a temporary password to sign in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            setCreatingEmployee(true);
            setCreateResult(null);
            try {
              const { data } = await api.post<{ data: { tempPassword?: string } }>(`/ats/applications/${application._id}/create-employee`);
              setCreateResult(data.data ?? null);
              showMsg('Employee created. Share the temporary password with the new joinee.');
              onUpdated();
            } catch (err: unknown) {
              showMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Create failed.');
            } finally {
              setCreatingEmployee(false);
            }
          },
        },
      ]
    );
  };

  const deleteApp = () => {
    if (!application) return;
    Alert.alert('Delete Application', 'Delete this application?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/ats/applications/${application._id}`);
            showMsg('Application deleted.');
            onUpdated();
            onClose();
          } catch (err: unknown) {
            showMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Delete failed.');
          }
        },
      },
    ]);
  };

  if (!application) return null;
  const appStatusOpt = APP_STATUS.find((s) => s.value === application.status);
  const isOfferOrHired = status === 'OFFER' || status === 'HIRED';

  return (
    <Modal visible animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={modalStyles.overlay}>
        <View style={modalStyles.box}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title} numberOfLines={1}>{application.candidateName ?? 'Application'}</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn}>
              <Text style={modalStyles.cancelText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={modalStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.meta}>{application.email} {application.phone ? `• ${application.phone}` : ''}</Text>
            {application.currentCompany ? <Text style={modalStyles.meta}>{application.currentCompany}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md }}>
              <View style={[appCardStyles.badge, { backgroundColor: appStatusOpt?.bg ?? '#f3f4f6' }]}>
                <Text style={[appCardStyles.badgeText, { color: appStatusOpt?.color ?? '#374151' }]}>{appStatusOpt?.label ?? application.status}</Text>
              </View>
              {application.resumeUrl ? (
                <TouchableOpacity onPress={() => Linking.openURL(application.resumeUrl!)} style={appCardStyles.linkBtn}>
                  <Text style={appCardStyles.linkBtnText}>Resume</Text>
                </TouchableOpacity>
              ) : null}
              {application.offerLetterUrl ? (
                <TouchableOpacity onPress={() => Linking.openURL(application.offerLetterUrl!)} style={[appCardStyles.linkBtn, { backgroundColor: '#15803d' }]}>
                  <Text style={appCardStyles.linkBtnText}>Offer</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {application.createdEmployee ? (
              <Text style={modalStyles.meta}>Employee: {application.createdEmployee.name} ({application.createdEmployee.employeeId ?? ''})</Text>
            ) : null}

            <Text style={modalStyles.label}>Status</Text>
            <View style={modalStyles.rowWrap}>
              {APP_STATUS.map((s) => (
                <TouchableOpacity key={s.value} style={[modalStyles.chip, status === s.value && modalStyles.chipActive]} onPress={() => setStatus(s.value)}>
                  <Text style={[modalStyles.chipText, status === s.value && modalStyles.chipTextActive]} numberOfLines={1}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={modalStyles.label}>Rating (1-5)</Text>
            <TextInput value={rating} onChangeText={setRating} keyboardType="number-pad" style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Interview Date</Text>
            <TextInput value={interviewDate} onChangeText={setInterviewDate} placeholder="YYYY-MM-DD" style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Offered Salary (₹)</Text>
            <TextInput value={offeredSalary} onChangeText={setOfferedSalary} keyboardType="number-pad" style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
            {status === 'HIRED' && (
              <>
                <Text style={modalStyles.label}>Joining Date</Text>
                <TextInput value={hiredAt} onChangeText={setHiredAt} placeholder="YYYY-MM-DD" style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
              </>
            )}
            <Text style={modalStyles.label}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} multiline numberOfLines={2} style={[modalStyles.input, modalStyles.textArea]} placeholderTextColor={AppColors.textSecondary} />
            <Text style={modalStyles.label}>Interview Feedback</Text>
            <TextInput value={interviewFeedback} onChangeText={setInterviewFeedback} multiline numberOfLines={2} style={[modalStyles.input, modalStyles.textArea]} placeholderTextColor={AppColors.textSecondary} />
            {(status === 'REJECTED' || status === 'WITHDRAWN') && (
              <>
                <Text style={modalStyles.label}>Reason</Text>
                <TextInput value={rejectedReason} onChangeText={setRejectedReason} placeholder="Rejection / withdrawal reason" style={modalStyles.input} placeholderTextColor={AppColors.textSecondary} />
              </>
            )}

            <TouchableOpacity onPress={save} disabled={saving} style={[modalStyles.saveBtn, saving && modalStyles.saveBtnDisabled]}>
              <Text style={modalStyles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>

            {isOfferOrHired && (
              <TouchableOpacity onPress={uploadOfferLetter} disabled={uploadingOffer} style={[modalStyles.saveBtn, { backgroundColor: '#15803d', marginTop: Spacing.sm }]}>
                <Text style={modalStyles.saveBtnText}>{uploadingOffer ? 'Uploading…' : (application.offerLetterUrl ? 'Replace offer letter' : 'Upload offer letter')}</Text>
              </TouchableOpacity>
            )}

            {status === 'HIRED' && !application.createdEmployee && (
              <>
                <TouchableOpacity onPress={createEmployee} disabled={creatingEmployee} style={[modalStyles.saveBtn, { backgroundColor: '#15803d', marginTop: Spacing.sm }]}>
                  <Text style={modalStyles.saveBtnText}>{creatingEmployee ? 'Creating…' : 'Create Employee'}</Text>
                </TouchableOpacity>
                {createResult?.tempPassword ? (
                  <View style={modalStyles.resultBox}>
                    <Text style={modalStyles.resultTitle}>Employee created</Text>
                    <Text style={modalStyles.resultText}>Temp password: {createResult.tempPassword}</Text>
                    <Text style={modalStyles.resultHint}>Share this password with the new joinee.</Text>
                  </View>
                ) : null}
              </>
            )}

            <TouchableOpacity onPress={deleteApp} style={[modalStyles.saveBtn, { backgroundColor: AppColors.danger, marginTop: Spacing.lg }]}>
              <Text style={modalStyles.saveBtnText}>Delete Application</Text>
            </TouchableOpacity>
            <View style={{ height: Spacing.section }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Application pipeline card (compact, move-to buttons) ───────────────
function ApplicationPipelineCard({
  application,
  onMove,
  onOpenDetail,
  showMsg,
}: {
  application: Application;
  onMove: () => void;
  onOpenDetail: () => void;
  showMsg: (m: string) => void;
}) {
  const nextOptions = getNextStages(application.status ?? 'APPLIED');
  const [moving, setMoving] = useState(false);

  const moveTo = async (newStatus: string) => {
    setMoving(true);
    try {
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'INTERVIEW' && !application.interviewDate) payload.interviewDate = new Date().toISOString().split('T')[0];
      await api.patch(`/ats/applications/${application._id}`, payload);
      showMsg(`Moved to ${APP_STATUS.find((s) => s.value === newStatus)?.label ?? newStatus}.`);
      onMove();
    } catch (err: unknown) {
      showMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.');
    } finally {
      setMoving(false);
    }
  };

  const opt = APP_STATUS.find((s) => s.value === application.status);

  return (
    <View style={appCardStyles.card}>
      <Text style={appCardStyles.name} numberOfLines={1}>{application.candidateName ?? '—'}</Text>
      <Text style={appCardStyles.email} numberOfLines={1}>{application.email ?? '—'}</Text>
      {application.rating != null && <Text style={appCardStyles.rating}>★ {application.rating}/5</Text>}
      <View style={appCardStyles.moveRow}>
        {nextOptions.slice(0, 4).map((st) => {
          const sOpt = APP_STATUS.find((s) => s.value === st);
          return (
            <TouchableOpacity key={st} onPress={() => moveTo(st)} disabled={moving} style={appCardStyles.moveBtn}>
              <Text style={[appCardStyles.moveBtnText, { color: sOpt?.color ?? '#374151' }]}>{sOpt?.label ?? st}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity onPress={onOpenDetail} style={appCardStyles.detailLink}>
        <Text style={appCardStyles.detailLinkText}>Edit details</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Job card (expandable, applications pipeline/list) ───────────────────
function JobCard({
  job,
  onEdit,
  onDelete,
  onRefresh,
  showMsg,
}: {
  job: Job;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  showMsg: (m: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [appLoading, setAppLoading] = useState(false);
  const [showAppForm, setShowAppForm] = useState(false);
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
  const [detailApp, setDetailApp] = useState<Application | null>(null);

  const loadApplications = useCallback(async () => {
    setAppLoading(true);
    try {
      const params: Record<string, string> = {};
      if (viewMode === 'list' && appStatusFilter) params.status = appStatusFilter;
      const { data } = await api.get<{ data: Application[] }>(`/ats/jobs/${job._id}/applications`, { params });
      setApplications(data.data ?? []);
    } catch {
      setApplications([]);
    } finally {
      setAppLoading(false);
    }
  }, [job._id, appStatusFilter, viewMode]);

  useEffect(() => {
    if (expanded) loadApplications();
  }, [expanded, loadApplications]);

  const byStage = applications.reduce<Record<string, Application[]>>((acc, app) => {
    const s = app.status ?? 'APPLIED';
    if (!acc[s]) acc[s] = [];
    acc[s].push(app);
    return acc;
  }, {});

  const jobStatusStyle = JOB_STATUS.find((s) => s.value === job.status) ?? JOB_STATUS[0];
  const deptName = (job.department as Department)?.name ?? '—';
  const empLabel = EMP_TYPE.find((e) => e.value === job.employmentType)?.label ?? job.employmentType ?? '';

  return (
    <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: jobStatusStyle.color }]}>
      <TouchableOpacity
        style={styles.cardTop}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.cardTopLeft}>
          <MaterialIcons name={expanded ? 'expand-more' : 'chevron-right'} size={24} color={AppColors.textSecondary} />
          <View>
            <Text style={styles.jobTitle} numberOfLines={2}>{job.title ?? '—'}</Text>
            <Text style={styles.jobMeta}>
              {deptName} · {empLabel} · {job.applicationCount ?? 0} applications
              {job.hiredCount ? ` · ${job.hiredCount} hired` : ''}
            </Text>
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: jobStatusStyle.bg }]}>
          <Text style={[styles.badgeText, { color: jobStatusStyle.color }]}>{jobStatusStyle.label}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
          <MaterialIcons name="edit" size={18} color={AppColors.tint} />
          <Text style={styles.actionBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={[styles.actionBtn, { marginLeft: Spacing.sm }]}>
          <MaterialIcons name="delete-outline" size={18} color={AppColors.danger} />
          <Text style={[styles.actionBtnText, { color: AppColors.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.expanded}>
          <View style={styles.appToolbar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <TouchableOpacity style={[styles.appChip, !appStatusFilter && styles.appChipActive]} onPress={() => setAppStatusFilter('')}>
                <Text style={[styles.appChipText, !appStatusFilter && styles.appChipTextActive]}>All</Text>
              </TouchableOpacity>
              {PIPELINE_STAGES.map((st) => (
                <TouchableOpacity key={st} style={[styles.appChip, appStatusFilter === st && styles.appChipActive]} onPress={() => setAppStatusFilter(appStatusFilter === st ? '' : st)}>
                  <Text style={[styles.appChipText, appStatusFilter === st && styles.appChipTextActive]}>{APP_STATUS.find((s) => s.value === st)?.label ?? st}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.appChip, appStatusFilter === 'REJECTED' && styles.appChipActive]} onPress={() => setAppStatusFilter(appStatusFilter === 'REJECTED' ? '' : 'REJECTED')}>
                <Text style={[styles.appChipText, appStatusFilter === 'REJECTED' && styles.appChipTextActive]}>Rejected</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.appChip, appStatusFilter === 'WITHDRAWN' && styles.appChipActive]} onPress={() => setAppStatusFilter(appStatusFilter === 'WITHDRAWN' ? '' : 'WITHDRAWN')}>
                <Text style={[styles.appChipText, appStatusFilter === 'WITHDRAWN' && styles.appChipTextActive]}>Withdrawn</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.viewModeRow}>
              <TouchableOpacity style={[styles.viewModeBtn, viewMode === 'pipeline' && styles.viewModeBtnActive]} onPress={() => setViewMode('pipeline')}>
                <Text style={[styles.viewModeBtnText, viewMode === 'pipeline' && styles.viewModeBtnTextActive]}>Pipeline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]} onPress={() => setViewMode('list')}>
                <Text style={[styles.viewModeBtnText, viewMode === 'list' && styles.viewModeBtnTextActive]}>List</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShowAppForm(true)} style={styles.addAppBtn}>
              <MaterialIcons name="person-add" size={18} color="#fff" />
              <Text style={styles.addAppBtnText}>Add Application</Text>
            </TouchableOpacity>
          </View>

          {showAppForm && (
            <AddApplicationModal
              jobId={job._id}
              onClose={() => setShowAppForm(false)}
              onSaved={() => {
                setShowAppForm(false);
                loadApplications();
                onRefresh();
              }}
              showMsg={showMsg}
            />
          )}

          {detailApp && (
            <ApplicationDetailModal
              application={detailApp}
              onClose={() => setDetailApp(null)}
              onUpdated={() => {
                loadApplications();
                onRefresh();
              }}
              showMsg={showMsg}
            />
          )}

          {appLoading ? (
            <View style={styles.appLoading}>
              <ActivityIndicator size="small" color={AppColors.tint} />
              <Text style={styles.appLoadingText}>Loading applications…</Text>
            </View>
          ) : applications.length === 0 ? (
            <Text style={styles.appEmpty}>No applications yet. Add candidates to move them through the pipeline.</Text>
          ) : viewMode === 'pipeline' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.pipelineScroll} contentContainerStyle={styles.pipelineContent}>
              {PIPELINE_STAGES.map((st) => (
                <View key={st} style={styles.pipelineColumn}>
                  <View style={[styles.pipelineColumnHead, { backgroundColor: APP_STATUS.find((s) => s.value === st)?.bg ?? '#f1f5f9' }]}>
                    <Text style={[styles.pipelineColumnHeadText, { color: APP_STATUS.find((s) => s.value === st)?.color ?? '#374151' }]} numberOfLines={1}>
                      {APP_STATUS.find((s) => s.value === st)?.label ?? st} {(byStage[st] ?? []).length}
                    </Text>
                  </View>
                  <ScrollView style={styles.pipelineColumnBody} nestedScrollEnabled>
                    {(byStage[st] ?? []).map((app) => (
                      <ApplicationPipelineCard
                        key={app._id}
                        application={app}
                        onMove={loadApplications}
                        onOpenDetail={() => setDetailApp(app)}
                        showMsg={showMsg}
                      />
                    ))}
                  </ScrollView>
                </View>
              ))}
              {(byStage['REJECTED']?.length ?? 0) + (byStage['WITHDRAWN']?.length ?? 0) > 0 && (
                <View style={styles.pipelineColumn}>
                  <View style={[styles.pipelineColumnHead, { backgroundColor: '#fef2f2' }]}>
                    <Text style={[styles.pipelineColumnHeadText, { color: '#b91c1c' }]}>
                      Out ({(byStage['REJECTED'] ?? []).length + (byStage['WITHDRAWN'] ?? []).length})
                    </Text>
                  </View>
                  <ScrollView style={styles.pipelineColumnBody} nestedScrollEnabled>
                    {[...(byStage['REJECTED'] ?? []), ...(byStage['WITHDRAWN'] ?? [])].map((app) => (
                      <ApplicationPipelineCard
                        key={app._id}
                        application={app}
                        onMove={loadApplications}
                        onOpenDetail={() => setDetailApp(app)}
                        showMsg={showMsg}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.listWrap}>
              {applications.map((app) => {
                const aOpt = APP_STATUS.find((s) => s.value === app.status);
                return (
                  <TouchableOpacity
                    key={app._id}
                    style={appCardStyles.listRow}
                    onPress={() => setDetailApp(app)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={appCardStyles.name} numberOfLines={1}>{app.candidateName ?? '—'}</Text>
                      <Text style={appCardStyles.email} numberOfLines={1}>{app.email ?? '—'} {app.phone ? `· ${app.phone}` : ''}</Text>
                    </View>
                    <View style={[appCardStyles.badge, { backgroundColor: aOpt?.bg ?? '#f3f4f6' }]}>
                      <Text style={[appCardStyles.badgeText, { color: aOpt?.color ?? '#374151' }]} numberOfLines={1}>{aOpt?.label ?? app.status}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={AppColors.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {job.closingDate ? <Text style={styles.closeDate}>Closes {fmt(job.closingDate)}</Text> : null}
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────
export default function RecruitmentScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (jobSearch.trim()) params.search = jobSearch.trim();
      const [jobsRes, statsRes] = await Promise.all([
        api.get<{ data: Job[] }>('/ats/jobs', { params }),
        api.get<{ data: Stats }>('/ats/jobs/stats'),
      ]);
      setJobs(jobsRes.data.data ?? []);
      setStats(statsRes.data.data ?? {});
    } catch {
      setJobs([]);
      setStats({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, jobSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get<{ data: Department[] }>('/departments').then(({ data }) => setDepartments(data.data ?? [])).catch(() => {});
    api.get<{ data: User[] }>('/users').then(({ data }) => setManagers(data.data ?? [])).catch(() => {});
  }, []);

  const showMsg = (m: string) => {
    setMsg(m);
    const t = setTimeout(() => setMsg(''), 3500);
    return () => clearTimeout(t);
  };

  const handleDeleteJob = (job: Job) => {
    Alert.alert(
      'Delete Job',
      'Delete this job and all its applications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/ats/jobs/${job._id}`);
              showMsg('Job deleted.');
              load();
            } catch (err: unknown) {
              showMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Delete failed.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: AppColors.background }]}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={Platform.OS === 'ios' ? 22 : 24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recruitment</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.tint} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageSubtitle}>Jobs → Applications → Shortlist → Interview → Offer → Hired</Text>

        {msg ? (
          <View style={[styles.msgBox, msg.includes('success') || msg.includes('added') || msg.includes('updated') || msg.includes('deleted') ? styles.msgBoxSuccess : styles.msgBoxError]}>
            <Text style={styles.msgText}>{msg}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={() => { setEditingJob(null); setShowJobForm(true); }} style={styles.newJobBtn}>
          <MaterialIcons name="add" size={22} color="#fff" />
          <Text style={styles.newJobBtnText}>New Job Opening</Text>
        </TouchableOpacity>

        {showJobForm && (
          <JobFormModal
            key={editingJob?._id ?? 'new'}
            job={editingJob}
            departments={departments}
            managers={managers}
            onClose={() => { setShowJobForm(false); setEditingJob(null); }}
            onSaved={() => { showMsg('Job saved.'); setShowJobForm(false); setEditingJob(null); load(); }}
            showMsg={showMsg}
          />
        )}

        {!loading && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
              <Text style={[styles.statValue, { color: '#2563eb' }]}>{stats.openJobs ?? 0}</Text>
              <Text style={[styles.statLabel, { color: '#2563eb' }]}>Open Jobs</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
              <Text style={[styles.statValue, { color: '#15803d' }]}>{stats.totalApplications ?? 0}</Text>
              <Text style={[styles.statLabel, { color: '#15803d' }]}>Applications</Text>
            </View>
            {stats.byStatus && Object.entries(stats.byStatus).slice(0, 4).map(([status, count]) => (
              <View key={status} style={[styles.statCard, { backgroundColor: '#f9fafb' }]}>
                <Text style={[styles.statValue, { color: '#374151' }]}>{count}</Text>
                <Text style={[styles.statLabel, { color: '#6b7280' }]} numberOfLines={1}>{APP_STATUS.find((s) => s.value === status)?.label ?? status}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.filterLabel}>Search & filter</Text>
        <TextInput
          value={jobSearch}
          onChangeText={setJobSearch}
          placeholder="Search jobs…"
          style={styles.searchInput}
          placeholderTextColor={AppColors.textSecondary}
        />
        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.chip, !statusFilter && styles.chipActive]} onPress={() => setStatusFilter('')}>
            <Text style={[styles.chipText, !statusFilter && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {JOB_STATUS.map((s) => {
            const selected = statusFilter === s.value;
            return (
              <TouchableOpacity key={s.value} style={[styles.chip, selected && styles.chipActive]} onPress={() => setStatusFilter(selected ? '' : s.value)}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.tint} />
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : jobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="work" size={48} color={AppColors.textSecondary} />
            <Text style={styles.emptyText}>No job openings</Text>
            <Text style={styles.muted}>Create one to start receiving applications.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {jobs.map((j) => (
              <JobCard
                key={j._id}
                job={j}
                onEdit={() => { setEditingJob(j); setShowJobForm(true); }}
                onDelete={() => handleDeleteJob(j)}
                onRefresh={load}
                showMsg={showMsg}
              />
            ))}
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

// ─── Modal styles ───────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  box: {
    backgroundColor: AppColors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  title: { fontSize: 18, fontWeight: '700', color: AppColors.text, flex: 1 },
  cancelBtn: { padding: Spacing.sm }, cancelText: { fontSize: 16, color: AppColors.tint, fontWeight: '600' },
  body: { padding: Spacing.lg, maxHeight: 400 },
  label: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.2)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: AppColors.text,
  },
  textArea: { minHeight: 72 },
  pickerWrap: { marginBottom: Spacing.sm },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)' },
  chipActive: { backgroundColor: AppColors.tint },
  chipText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  chipTextActive: { color: '#fff' },
  fileBtn: { padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)', alignSelf: 'flex-start' },
  fileBtnText: { fontSize: 14, color: AppColors.tint, fontWeight: '600' },
  saveBtn: { backgroundColor: AppColors.tint, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.lg },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  meta: { fontSize: 13, color: AppColors.textSecondary, marginBottom: 4 },
  resultBox: { marginTop: Spacing.md, padding: Spacing.md, backgroundColor: '#f0fdf4', borderRadius: BorderRadius.md },
  resultTitle: { fontSize: 14, fontWeight: '700', color: '#15803d' },
  resultText: { fontSize: 13, color: AppColors.text, marginTop: 4 },
  resultHint: { fontSize: 12, color: AppColors.textSecondary, marginTop: 4 },
});

const appCardStyles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.12)',
  },
  name: { fontSize: 14, fontWeight: '700', color: AppColors.text },
  email: { fontSize: 12, color: AppColors.textSecondary },
  rating: { fontSize: 12, color: AppColors.text, marginTop: 2 },
  moveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  moveBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)' },
  moveBtnText: { fontSize: 11, fontWeight: '600' },
  detailLink: { marginTop: 6 },
  detailLinkText: { fontSize: 12, color: AppColors.tint, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  linkBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: AppColors.tint, alignSelf: 'flex-start' },
  linkBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.12)',
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeTop: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.section },
  bottomPad: { height: Spacing.section },
  pageSubtitle: { fontSize: 14, color: AppColors.textSecondary, marginBottom: Spacing.lg },
  msgBox: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  msgBoxSuccess: { backgroundColor: '#dcfce7' },
  msgBoxError: { backgroundColor: '#fef2f2' },
  msgText: { fontSize: 14, fontWeight: '600' },
  newJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: AppColors.tint,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  newJobBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: { flex: 1, minWidth: 90, padding: Spacing.lg, borderRadius: BorderRadius.xl, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  filterLabel: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary, marginBottom: Spacing.sm },
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.2)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: AppColors.text,
    marginBottom: Spacing.md,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)' },
  chipActive: { backgroundColor: AppColors.tint },
  chipText: { fontSize: 13, fontWeight: '600', color: AppColors.text },
  chipTextActive: { color: '#fff' },
  muted: { fontSize: 14, color: AppColors.textSecondary, marginTop: Spacing.sm },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    ...CardShadow,
  },
  emptyText: { fontSize: 17, fontWeight: '600', color: AppColors.text, marginTop: Spacing.md },
  list: { gap: Spacing.md },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...CardShadow,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  jobTitle: { fontSize: 16, fontWeight: '700', color: AppColors.text, flex: 1 },
  jobMeta: { fontSize: 13, color: AppColors.textSecondary },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', marginTop: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.tint },
  closeDate: { fontSize: 12, color: AppColors.textSecondary, marginTop: 4 },
  expanded: { marginTop: Spacing.lg, paddingTop: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.12)' },
  appToolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  filterScroll: { maxHeight: 44 },
  appChip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.md, backgroundColor: 'rgba(118,118,128,0.12)', marginRight: Spacing.sm },
  appChipActive: { backgroundColor: AppColors.tint },
  appChipText: { fontSize: 12, fontWeight: '600', color: AppColors.text },
  appChipTextActive: { color: '#fff' },
  viewModeRow: { flexDirection: 'row', gap: 4 },
  viewModeBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(60,60,67,0.2)' },
  viewModeBtnActive: { backgroundColor: '#eff6ff', borderColor: AppColors.tint },
  viewModeBtnText: { fontSize: 12, fontWeight: '600', color: AppColors.textSecondary },
  viewModeBtnTextActive: { color: AppColors.tint },
  addAppBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#15803d', paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md },
  addAppBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  appLoading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  appLoadingText: { fontSize: 14, color: AppColors.textSecondary },
  appEmpty: { fontSize: 14, color: AppColors.textSecondary, paddingVertical: Spacing.lg },
  pipelineScroll: { marginHorizontal: -Spacing.xl },
  pipelineContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  pipelineColumn: { width: 160, marginRight: Spacing.md, backgroundColor: '#f8fafc', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(60,60,67,0.1)', overflow: 'hidden' },
  pipelineColumnHead: { paddingVertical: 8, paddingHorizontal: Spacing.sm },
  pipelineColumnHeadText: { fontSize: 12, fontWeight: '700' },
  pipelineColumnBody: { maxHeight: 280 },
  listWrap: {},
});
