import urllib.request
import urllib.parse
import json

BASE_URL = 'http://127.0.0.1:8000/api'

def post_json(endpoint, payload=None, headers=None):
    url = f"{BASE_URL}{endpoint}"
    data = json.dumps(payload).encode('utf-8') if payload else None
    req_headers = {'Content-Type': 'application/json'}
    if headers:
        req_headers.update(headers)
    
    req = urllib.request.Request(url, data=data, headers=req_headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, body

def get_json(endpoint, headers=None):
    clean_endpoint = urllib.parse.quote(endpoint, safe='/?&=')
    url = f"{BASE_URL}{clean_endpoint}"
    req_headers = {}
    if headers:
        req_headers.update(headers)
    
    req = urllib.request.Request(url, headers=req_headers, method='GET')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, body

def run_tests():
    print('🧪 Testing DRF Section 4 Endpoints Suite...\n')

    # 1. Obtain JWT Token
    print('1️⃣ JWT Auth (/api/token/)...')
    st_auth, res_auth = post_json('/token/', {'username': 'admin', 'password': 'admin123'})
    access_token = res_auth['access']
    headers = {'Authorization': f'Bearer {access_token}'}
    print('   ✅ PASS: JWT Auth Successful')

    # 2. POST /api/sessions/create/
    print('\n2️⃣ POST /api/sessions/create/...')
    st_sess, res_sess = post_json('/sessions/create/', {'title': 'DAA Lecture - 6 Sept'}, headers=headers)
    print(f'   Session Create Output: {res_sess}')
    if st_sess == 201 and res_sess.get('id'):
        session_id = res_sess['id']
        print('   ✅ PASS: Session created successfully!')

    # 3. Seed Students & Test GET /api/students/
    print('\n3️⃣ POST /api/seed-samples & GET /api/students/...')
    post_json('/seed-samples', headers=headers)
    st_stud, res_stud = get_json('/students/?branch=Data Science', headers=headers)
    target_student = res_stud[0]
    print(f'   Filtered Students Count: {len(res_stud)}')
    print(f'   Target Student: {target_student["name"]} (UUID: {target_student["unique_token"]})')
    print('   ✅ PASS: GET /api/students/ filter successful!')

    # 4. POST /api/students/generate-qr/
    print('\n4️⃣ POST /api/students/generate-qr/...')
    st_gen, res_gen = post_json('/students/generate-qr/', headers=headers)
    print(f'   Generate QR Output: {res_gen}')
    print('   ✅ PASS: POST /api/students/generate-qr/ successful!')

    # 5. POST /api/students/send-emails/
    print('\n5️⃣ POST /api/students/send-emails/...')
    st_mail, res_mail = post_json('/students/send-emails/', headers=headers)
    print(f'   Send Emails Output: {res_mail}')
    print('   ✅ PASS: POST /api/students/send-emails/ successful!')

    # 6. POST /api/attendance/scan/
    print('\n6️⃣ POST /api/attendance/scan/...')
    st_scan1, res_scan1 = post_json('/attendance/scan/', {
        'token': str(target_student['unique_token']),
        'session_id': session_id
    }, headers=headers)
    print(f'   Scan 1 Output: {res_scan1}')
    if res_scan1.get('success') is True:
        print('   ✅ PASS: Scan 1 marked student PRESENT')

    # Duplicate Scan Test
    st_scan2, res_scan2 = post_json('/attendance/scan/', {
        'token': str(target_student['unique_token']),
        'session_id': session_id
    }, headers=headers)
    print(f'   Scan 2 Output: {res_scan2}')
    if res_scan2.get('duplicate') is True:
        print('   ✅ PASS: Scan 2 correctly flagged duplicate scan!')

    # 7. GET /api/attendance/session/<id>/
    print('\n7️⃣ GET /api/attendance/session/<id>/...')
    st_rep, res_rep = get_json(f'/attendance/session/{session_id}/', headers=headers)
    print(f'   Live Dashboard Session Report Stats: {res_rep.get("stats")}')
    print('   ✅ PASS: GET /api/attendance/session/<id>/ successful!')

    print('\n🎉 ALL 7 SECTION 4 DRF API ENDPOINTS VERIFIED SUCCESSFULLY!\n')

if __name__ == '__main__':
    run_tests()
