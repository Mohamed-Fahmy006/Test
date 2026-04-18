import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

const API_URL = '/api';

export default function App() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('booking_token') || '';
    } catch (e) {
      console.warn('Storage blocked:', e);
      return '';
    }
  });
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('booking_user')) || null;
    } catch (e) {
      console.warn('Storage blocked:', e);
      return null;
    }
  });
  const [metadata, setMetadata] = useState({ rooms: [], slots: [] });

  const login = (userData) => {
    setToken(userData.token);
    setUser({ role: userData.role, name: userData.fullName });
    try {
      localStorage.setItem('booking_token', userData.token);
      localStorage.setItem('booking_user', JSON.stringify({ role: userData.role, name: userData.fullName }));
    } catch (e) {
      console.warn('Could not save to storage:', e);
    }
  };

  const logout = () => {
    setToken('');
    setUser(null);
    try {
      localStorage.removeItem('booking_token');
      localStorage.removeItem('booking_user');
    } catch (e) {
      console.warn('Could not clear storage:', e);
    }
  };

  const getErrorMessage = (err) => {
    if (typeof err === 'string') return err;
    if (err?.response?.data?.error) {
      return typeof err.response.data.error === 'string' 
        ? err.response.data.error 
        : JSON.stringify(err.response.data.error);
    }
    if (err?.response?.data?.details) {
      return typeof err.response.data.details === 'string'
        ? err.response.data.details
        : JSON.stringify(err.response.data.details);
    }
    if (err?.message) {
      return typeof err.message === 'string' ? err.message : JSON.stringify(err.message);
    }
    return 'حدث خطأ غير معروف';
  };

  useEffect(() => {
    if (token) {
      axios.get(`${API_URL}/metadata`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setMetadata(res.data))
        .catch(err => {
          if (err.response && err.response.status === 403) logout();
        });
    }
  }, [token]);

  if (!token || !user) {
    return <LoginScreen onLogin={login} getErrorMessage={getErrorMessage} />;
  }

  return (
    <MainApp user={user} logout={logout} metadata={metadata} token={token} getErrorMessage={getErrorMessage} />
  );
}

function LoginScreen({ onLogin, getErrorMessage }) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { employee_id: employeeId, password });
      onLogin(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <div className="login-wrapper">
        <div className="glass-panel login-panel">
          <div className="login-header">
            <div className="logo-circle">
              <i className="fa-solid fa-building-columns"></i>
            </div>
            <h2>الأكاديمية العربية</h2>
            <p>نظام إدارة وحجز القاعات والمدرجات</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>الرقم الوظيفي</label>
              <div className="input-icon">
                <i className="fa-regular fa-id-badge"></i>
                <input type="text" value={employeeId} onChange={e => setEmployeeId(e.target.value)} required placeholder="أدخل رقمك الوظيفي" />
              </div>
            </div>
            <div className="input-group">
              <label>كلمة المرور</label>
              <div className="input-icon">
                <i className="fa-solid fa-lock"></i>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="أدخل كلمة المرور" />
              </div>
            </div>
            <button type="submit" className="btn-primary">تسجيل الدخول</button>
            {error && <div className="error-text">{error}</div>}
          </form>
          <div className="login-hints">
            <p>أرقام تجريبية:</p>
            <small>مسئول: 100، مدير فرع: 200، موظف: 300، سكرتير: 400</small>
            <br />
            <small style={{ color: 'var(--warning)' }}>كلمات المرور: admin123, mngr, emp, sec</small>
          </div>
        </div>
        <div className="background-decorations">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>
      </div>
    </div>
  );
}

function MainApp({ user, logout, metadata, token, getErrorMessage }) {
  const isEmployeeOrSec = ['Employee', 'Secretary'].includes(user.role);
  const isAdminOrMngr = ['Admin', 'Branch Manager'].includes(user.role);
  
  const [activeTab, setActiveTab] = useState(isAdminOrMngr ? 'dashboard' : 'booking');

  return (
    <div id="app-screen" className="active">
      <aside className="sidebar glass-panel">
        <div className="sidebar-header">
          <div className="logo-small"><i className="fa-solid fa-building-columns"></i></div>
          <h3>إدارة القاعات</h3>
        </div>
        <div className="user-info">
          <div className="avatar"><i className="fa-solid fa-user-tie"></i></div>
          <div>
            <h4>{user.name}</h4>
            <span className="role-badge">{user.role}</span>
          </div>
        </div>
        <nav className="nav-menu">
          {isEmployeeOrSec && (
            <>
              <a className={`nav-item ${activeTab === 'booking' ? 'active' : ''}`} onClick={() => setActiveTab('booking')}>
                <i className="fa-solid fa-calendar-plus"></i> طلب حجز
              </a>
              <a className={`nav-item ${activeTab === 'my-requests' ? 'active' : ''}`} onClick={() => setActiveTab('my-requests')}>
                <i className="fa-solid fa-list-check"></i> طلباتي السابقة
              </a>
            </>
          )}
          {isAdminOrMngr && (
            <>
              <a className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                <i className="fa-solid fa-chart-pie"></i> التقرير الصباحي
              </a>
              <a className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
                <i className="fa-solid fa-calendar-days"></i> الجدول الشامل
              </a>
            </>
          )}
          {user.role === 'Admin' && (
            <a className={`nav-item ${activeTab === 'delegate' ? 'active' : ''}`} onClick={() => setActiveTab('delegate')}>
              <i className="fa-solid fa-user-clock"></i> التفويض المؤقت
            </a>
          )}
        </nav>
        <button onClick={logout} className="btn-outline mt-auto">
          <i className="fa-solid fa-right-from-bracket"></i> تسجيل الخروج
        </button>
      </aside>

      <main className="main-content">
        <header className="top-header glass-panel">
          <h1>لوحة التحكم</h1>
        </header>

        <div className="content-body">
          {activeTab === 'booking' && <BlindBookingForm metadata={metadata} token={token} role={user.role} getErrorMessage={getErrorMessage} />}
          {activeTab === 'my-requests' && <MyRequests token={token} />}
          {activeTab === 'dashboard' && <MorningReport token={token} />}
          {activeTab === 'calendar' && <AdminCalendar token={token} userRole={user.role} getErrorMessage={getErrorMessage} />}
          {activeTab === 'delegate' && <DelegationForm token={token} getErrorMessage={getErrorMessage} />}
        </div>
      </main>
    </div>
  );
}

function BlindBookingForm({ metadata, token, role, getErrorMessage }) {
  const [form, setForm] = useState({
    room_type: role === 'Secretary' ? 'Multi-purpose' : '',
    room_id: '',
    slot_id: '',
    booking_date: '',
    purpose: '',
    req_laptops: false,
    req_microphones: false,
    req_videoconf: false
  });
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setMsg('جاري الإرسال...');
    try {
      const payload = {
        ...form,
        req_laptops: form.req_laptops ? 1 : 0,
        req_microphones: form.req_microphones ? 1 : 0,
        req_videoconf: form.req_videoconf ? 1 : 0,
        booking_type: 'Exceptional'
      };
      
      const res = await axios.post(`${API_URL}/bookings/request`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg(`تم الإرسال بنجاح! رقم الحجز: ${res.data.bookingId}`);
    } catch(err) {
      setMsg(`خطأ: ${getErrorMessage(err)}`);
    }
  };

  const filteredRooms = metadata.rooms.filter(r => r.Room_Type === form.room_type);

  return (
    <div className="glass-panel" style={{ padding: '2rem' }}>
      <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>
        نموذج الحجز المخفي للمستخدمين (Blind Booking) - القاعات المتاحة لا تعرض لتجنب الانحياز.
      </p>
      <form onSubmit={submit} className="form-grid">
        <div className="input-group full-width">
          <label>نوع القاعة</label>
          <select value={form.room_type} onChange={e => setForm({...form, room_type: e.target.value, room_id: ''})} required disabled={role === 'Secretary'}>
            <option value="">-- اختر نوع القاعة --</option>
            <option value="Lecture Hall">قاعة محاضرات</option>
            <option value="Multi-purpose">قاعة متعددة الأغراض</option>
          </select>
        </div>
        <div className="input-group">
          <label>القاعة المحددة</label>
          <select value={form.room_id} onChange={e => setForm({...form, room_id: e.target.value})} required disabled={!form.room_type}>
            <option value="">-- اختر القاعة --</option>
            {filteredRooms.map(r => (
              <option key={r.Room_ID} value={r.Room_ID}>{r.Room_Name} (سعة: {r.Capacity})</option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label>الفترة الزمنية</label>
          <select value={form.slot_id} onChange={e => setForm({...form, slot_id: e.target.value})} required>
            <option value="">-- اختر الفترة --</option>
            {metadata.slots.map(s => (
              <option key={s.Slot_ID} value={s.Slot_ID}>{s.Start_Time} إلى {s.End_Time}</option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label>تاريخ الحجز</label>
          <input type="date" value={form.booking_date} onChange={e => setForm({...form, booking_date: e.target.value})} required />
        </div>
        <div className="input-group">
          <label>الغرض من الحجز</label>
          <input type="text" value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} required placeholder="مثال: محاضرة إضافية، ندوة..." />
        </div>
        <div className="input-group full-width">
          <label>التجهيزات التقنية</label>
          <div className="checkbox-group mt-2">
            <label className="checkbox-item">
              <input type="checkbox" checked={form.req_laptops} onChange={e => setForm({...form, req_laptops: e.target.checked})} /> 💻 أجهزة لابتوب
            </label>
            <label className="checkbox-item">
              <input type="checkbox" checked={form.req_microphones} onChange={e => setForm({...form, req_microphones: e.target.checked})} /> 🎤 ميكروفونات لاسلكية
            </label>
            <label className="checkbox-item">
              <input type="checkbox" checked={form.req_videoconf} onChange={e => setForm({...form, req_videoconf: e.target.checked})} /> 🎥 فيديو كونفرانس
            </label>
          </div>
        </div>
        <div className="full-width mt-4" style={{ color: msg.includes('نجاح') ? 'var(--secondary)' : 'var(--danger)' }}>{msg}</div>
        <button type="submit" className="btn-primary full-width mt-4">إرسال الطلب</button>
      </form>
    </div>
  );
}

function MyRequests({ token }) {
  const [requests, setRequests] = useState([]);
  
  useEffect(() => {
    axios.get(`${API_URL}/bookings/my-requests`, { headers: { Authorization: `Bearer ${token}` }})
      .then(res => setRequests(res.data));
  }, [token]);

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>القاعة</th>
              <th>التاريخ والفترة</th>
              <th>النوع</th>
              <th>الحالة</th>
              <th>الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.Booking_ID}>
                <td>{r.Room_Name} <small>({r.Room_Type})</small></td>
                <td>{r.Booking_Date}<br/><small dir="ltr">{r.Start_Time} - {r.End_Time}</small></td>
                <td>{r.Booking_Type}</td>
                <td>
                  <span className={`status ${r.Status === 'Pending' ? 'pending' : r.Status === 'Approved' ? 'approved' : 'rejected'}`}>
                    {r.Status === 'Pending' ? 'قيد المراجعة' : r.Status === 'Approved' ? 'مقبول' : 'مرفوض'}
                  </span>
                </td>
                <td><small>{r.Rejection_Reason ? `السبب: ${r.Rejection_Reason}` : '-'}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && <p style={{textAlign: 'center', margin: '2rem 0'}}>لا توجد طلبات سابقة.</p>}
      </div>
    </div>
  );
}

function MorningReport({ token }) {
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    axios.get(`${API_URL}/reports/morning-summary`, { headers: { Authorization: `Bearer ${token}` }})
      .then(res => setEvents(res.data));
  }, [token]);

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--secondary)'}}>
            <i className="fa-solid fa-users-viewfinder"></i>
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem' }}>{events.length}</h3>
            <p style={{ color: 'var(--text-muted)'}}>إجمالي الفعاليات المؤكدة اليوم</p>
          </div>
        </div>
      </div>
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}><i className="fa-solid fa-sun" style={{ color: 'var(--warning)'}}></i> قائمة تجهيزات اليوم</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>القاعة</th>
                <th>الفترة الزمنية</th>
                <th>الغرض</th>
                <th>التجهيزات الإضافية</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => {
                const reqs = [];
                if(e.Req_Laptops) reqs.push('أجهزة لابتوب');
                if(e.Req_Microphones) reqs.push('ميكروفونات');
                if(e.Req_VideoConf) reqs.push('فيديو كونفرانس');
                return (
                  <tr key={e.Booking_ID}>
                    <td>{e.Room_Name}</td>
                    <td dir="ltr">{e.Start_Time} - {e.End_Time}</td>
                    <td>{e.Purpose}</td>
                    <td style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>{reqs.length > 0 ? reqs.join(' + ') : 'بدون تجهيزات'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {events.length === 0 && <p style={{textAlign: 'center', margin: '2rem 0'}}>لا توجد فعاليات استثنائية لليوم.</p>}
        </div>
      </div>
    </>
  );
}

function AdminCalendar({ token, userRole, getErrorMessage }) {
  const [bookings, setBookings] = useState([]);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState(null);
  const [reason, setReason] = useState('');
  const [suggestion, setSuggestion] = useState('');

  const fetchBookings = () => {
    axios.get(`${API_URL}/admin/calendar-view`, { headers: { Authorization: `Bearer ${token}` }})
      .then(res => setBookings(res.data));
  };

  useEffect(() => { fetchBookings(); }, [token]);

  const respond = async (id, status, rejectReason = '', altSuggestion = '') => {
    try {
      await axios.patch(`${API_URL}/bookings/${id}/respond`, { status, reason: rejectReason, alternative_suggestion: altSuggestion }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRejectModalOpen(false);
      fetchBookings();
    } catch(err) {
      alert(`خطأ: ${getErrorMessage(err)}`);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>التاريخ والفترة</th>
              <th>القاعة المحددة</th>
              <th>بواسطة</th>
              <th>النوعية/الغرض</th>
              <th>الحالة</th>
              <th>تحكم</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(b => {
              const statusClass = b.Status === 'Pending' ? 'pending' : (b.Status === 'Approved' ? 'approved' : 'rejected');
              const canApprove = (b.Room_Type === 'Multi-purpose' && ['Branch Manager', 'Admin'].includes(userRole)) || (b.Room_Type === 'Lecture Hall' && userRole === 'Admin');
              
              return (
                <tr key={b.Booking_ID}>
                  <td>{b.Booking_Date}<br/><small dir="ltr">{b.Start_Time} - {b.End_Time}</small></td>
                  <td>{b.Room_Name} <small style={{ color: 'var(--text-muted)' }}>({b.Room_Type})</small></td>
                  <td>{b.Full_Name}</td>
                  <td>{b.Purpose}<br/><small style={{ color: 'var(--primary)'}}>{b.Booking_Type}</small></td>
                  <td>
                    <span className={`status ${statusClass}`}>
                      {b.Status === 'Pending' ? 'قيد المراجعة' : b.Status === 'Approved' ? 'مقبول' : 'مرفوض'}
                    </span>
                  </td>
                  <td>
                    {b.Status === 'Pending' && canApprove ? (
                      <>
                        <button className="btn-success" onClick={() => respond(b.Booking_ID, 'Approved')} style={{ marginLeft: '0.5rem' }}><i className="fa-solid fa-check"></i></button>
                        <button className="btn-danger" onClick={() => { setActiveBooking(b.Booking_ID); setRejectModalOpen(true); }}><i className="fa-solid fa-xmark"></i></button>
                      </>
                    ) : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rejectModalOpen && (
        <div className="modal active" style={{ display: 'flex' }}>
          <div className="modal-content glass-panel">
            <h3>اتخاذ إجراء بالرفض</h3>
            <div className="input-group">
              <label>سبب الرفض (إلزامي)</label>
              <textarea rows="3" value={reason} onChange={e => setReason(e.target.value)} placeholder="اكتب السبب..."></textarea>
            </div>
            <div className="input-group">
              <label>اقتراح بديل (اختياري)</label>
              <textarea rows="2" value={suggestion} onChange={e => setSuggestion(e.target.value)} placeholder="موعد أو قاعة بديلة..."></textarea>
            </div>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setRejectModalOpen(false)}>إلغاء</button>
              <button className="btn-danger" onClick={() => respond(activeBooking, 'Rejected', reason, suggestion)} disabled={!reason}>تأكيد الرفض</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DelegationForm({ token, getErrorMessage }) {
  const [form, setForm] = useState({ original_user: '', substitute_user: '', start_date: '', end_date: '' });
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setMsg('جاري التنفيذ...');
    try {
      await axios.post(`${API_URL}/admin/delegate`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg('تم إنشاء التفويض بنجاح للموظف البديل.');
      setForm({ original_user: '', substitute_user: '', start_date: '', end_date: '' });
    } catch(err) {
      setMsg(`خطأ: ${getErrorMessage(err)}`);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px' }}>
      <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>
        تفويض صلاحيات من الموظف الأساسي إلى موظف بديل بصلاحية سارية المدة (يبطل تلقائياً).
      </p>
      <form onSubmit={submit} className="form-grid">
        <div className="input-group full-width">
          <label>رقم الموظف الأساسي (صاحب الصلاحية)</label>
          <input type="number" value={form.original_user} onChange={e => setForm({...form, original_user: e.target.value})} required placeholder="مثال: 200" />
        </div>
        <div className="input-group full-width">
          <label>رقم الموظف البديل (المفوض)</label>
          <input type="number" value={form.substitute_user} onChange={e => setForm({...form, substitute_user: e.target.value})} required placeholder="مثال: 300" />
        </div>
        <div className="input-group">
          <label>تاريخ البدء</label>
          <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required />
        </div>
        <div className="input-group">
          <label>تاريخ الانتهاء</label>
          <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} required />
        </div>
        <div className="full-width mt-4" style={{ color: msg.includes('خطأ') ? 'var(--danger)' : 'var(--secondary)'}}>{msg}</div>
        <button type="submit" className="btn-primary full-width mt-4">حفظ بيانات التفويض</button>
      </form>
    </div>
  );
}
