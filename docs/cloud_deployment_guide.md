# ☁️ คู่มือการติดตั้งโปรเจค Lawyer Tech ERP บนระบบคลาวด์ (Production Deployment Guide)

คู่มือนี้จะอธิบายขั้นตอนการอัปโหลดระบบขึ้นออนไลน์จริง เพื่อให้ระบบทำงานได้ตลอด 24 ชั่วโมง โดยแบ่งเป็น 4 ขั้นตอนหลัก:
1. การสร้างและตั้งค่าฐานข้อมูลออนไลน์ (Supabase PostgreSQL)
2. การติดตั้ง Backend (FastAPI) บน Vercel
3. การเตรียมตารางฐานข้อมูลและสร้างข้อมูลเริ่มต้น (Database Migration & Seeding)
4. การติดตั้ง Frontend และ Superadmin บน Vercel

---

## 1. 🗄️ การสร้างและตั้งค่าฐานข้อมูลออนไลน์ (แนะนำ Supabase)
เนื่องจากระบบนี้ใช้ฟีเจอร์ AI และเวกเตอร์ในการค้นหากฎหมาย/ฎีกา จึงจำเป็นต้องใช้ฐานข้อมูล PostgreSQL ที่รองรับ **pgvector**

1. สมัครใช้งานและเข้าสู่ระบบ [Supabase](https://supabase.com) (มีแพ็คเกจเริ่มต้นฟรี)
2. กดสร้างโปรเจคใหม่ (**New Project**) ตั้งชื่อและตั้งรหัสผ่านสำหรับฐานข้อมูล
3. เมื่อสร้างสำเร็จ ให้ไปที่เมนู **Database** (แถบเมนูด้านซ้าย) -> **Extensions**
4. ค้นหาคำว่า `vector` จากนั้นกดเปิดใช้งาน (Enable) **pgvector**
5. ไปที่หน้าเมนู **Settings** -> **Database** แล้วหาช่อง **Connection String**
   - เลือกแท็บ **URI**
   - เลือกโหมด **Transaction** หรือ **Session** (ปกติจะใช้พอร์ต `5432` หรือ `6543`)
   - ตัวอย่างรูปแบบ URL:
     ```text
     postgresql://postgres.[ProjectID]:[Password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
     ```
   - **สำคัญ**: เนื่องจากสแต็กของ FastAPI ในโปรเจคนี้ใช้งานแบบ **Async** (ผ่าน `asyncpg`) คุณต้องเปลี่ยนคำนำหน้า URL จาก `postgresql://` เป็น `postgresql+asyncpg://` เช่น:
     ```text
     postgresql+asyncpg://postgres.[ProjectID]:[Password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
     ```

---

## 2. 🚀 การติดตั้ง Backend (FastAPI) บน Vercel
โปรเจคนี้เตรียมความพร้อมสำหรับ Deploy บน Vercel ผ่านไฟล์ [vercel.json](file:///Users/3designs/เว็บทนาย/lawyer%20tech/backend/vercel.json) ไว้แล้ว

1. นำโค้ดของโปรเจคขึ้นสู่ **GitHub Repository** (แบบ Private)
2. เข้าสู่ระบบ [Vercel](https://vercel.com)
3. กดปุ่ม **Add New** -> **Project**
4. นำเข้า (Import) Repository จาก GitHub ของคุณ
5. ในขั้นตอนตั้งค่าโปรเจค:
   - **Framework Preset**: เลือกเป็น **Other**
   - **Root Directory**: เลือกโฟลเดอร์ `backend`
6. เปิดส่วน **Environment Variables** และใส่ค่าตัวแปรสภาพแวดล้อมดังนี้:
   - `DATABASE_URL` = (ค่า URI ของ Supabase ที่แปลงเป็น `postgresql+asyncpg://` แล้ว)
   - `SECRET_KEY` = (คีย์สำหรับ JWT แนะนำให้สุ่มคีย์ยาวๆ เช่น `openssl rand -hex 32`)
   - `GEMINI_API_KEY` = (API Key จาก Google AI Studio เพื่อใช้ฟีเจอร์ AI)
   - `OPENAI_API_KEY` = (ถ้าต้องการใช้ GPT-4o ของ OpenAI)
   - `PINECONE_API_KEY` = (ถ้าต้องการเชื่อมต่อ Vector DB ของ Pinecone)
7. กด **Deploy**
8. เมื่อเสร็จสิ้น คุณจะได้ URL ของ Backend (เช่น `https://your-backend.vercel.app`)
   - ทดสอบเข้าตรวจสอบหน้า API Swagger Docs ได้ที่ `https://your-backend.vercel.app/api/docs`

---

## 3. 🌱 การเตรียมฐานข้อมูลและสร้างข้อมูลเริ่มต้น (Database Seeding)
หลังจาก Deploy Backend และต่อฐานข้อมูล Supabase สำเร็จแล้ว เราต้องรันสคริปต์สร้างตารางฐานข้อมูลและข้อมูลตั้งต้น เช่น บัญชีผู้ดูแลระบบ (Admin) และแพ็กเกจราคา (Subscription Plans)

คุณสามารถรันสคริปต์นี้จากเครื่องคอมพิวเตอร์ของคุณ โดยให้มันยิงข้อมูลตรงเข้า Supabase ออนไลน์ได้ดังนี้:

1. เปิด Terminal ในเครื่องและไปที่โฟลเดอร์ `backend`
2. อัปเดตไฟล์ `.env` ในเครื่องของคุณชั่วคราวให้ชี้ไปที่ Supabase ออนไลน์:
   ```env
   DATABASE_URL="postgresql+asyncpg://postgres.[ProjectID]:[Password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
   ```
3. รันสคริปต์ [seed_data.py](file:///Users/3designs/เว็บทนาย/lawyer%20tech/backend/seed_data.py) ด้วยคำสั่ง:
   ```bash
   python seed_data.py
   ```
4. ระบบจะทำการตรวจสอบตาราง และสร้างข้อมูลเริ่มต้นขึ้นไปบน Supabase ให้โดยอัตโนมัติ
5. **บัญชีเริ่มต้นสำหรับการเข้าทดสอบระบบครั้งแรก (Seed User)**:
   - **Email**: `admin@lawyertech.co.th`
   - **Password**: `password123`

*(หมายเหตุ: หลังจากรันสำเร็จ แนะนำให้เปลี่ยนตัวแปร DATABASE_URL ในไฟล์ .env ของเครื่องกลับเป็น localhost หรือลบออกเพื่อความปลอดภัย)*

---

## 4. 💻 การติดตั้ง Frontend และ Superadmin บน Vercel
เราจะติดตั้งเว็บแอปพลิเคชันฝั่งหน้าบ้านทั้ง 2 ตัวแยกโครงการกัน

### A. สำหรับ Frontend (แอปสำหรับทนายความ)
1. ใน Vercel กดปุ่ม **Add New** -> **Project**
2. เลือก Repository เดียวกันจาก GitHub
3. ในขั้นตอนตั้งค่าโปรเจค:
   - **Framework Preset**: เลือกเป็น **Next.js**
   - **Root Directory**: เลือกโฟลเดอร์ `frontend`
4. เปิดส่วน **Environment Variables** และใส่ตัวแปรดังนี้:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend.vercel.app/api/v1` (URL Backend ของคุณจากขั้นตอนที่ 2)
   - `NEXT_PUBLIC_APP_NAME` = `Lawyer Tech ERP`
5. กด **Deploy**

### B. สำหรับ Superadmin (แอปจัดการ SaaS ระบบหลังบ้าน)
1. ใน Vercel กดปุ่ม **Add New** -> **Project**
2. เลือก Repository เดียวกันจาก GitHub
3. ในขั้นตอนตั้งค่าโปรเจค:
   - **Framework Preset**: เลือกเป็น **Next.js**
   - **Root Directory**: เลือกโฟลเดอร์ `superadmin`
4. เปิดส่วน **Environment Variables** และใส่ตัวแปรดังนี้:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend.vercel.app/api/v1`
5. กด **Deploy**

---

## 📱 5. การตั้งค่า LINE Login (กรณีต้องการใช้งาน)
หากต้องการให้ทนายหรือลูกความเข้าระบบผ่าน LINE ได้:
1. เข้าไปที่ [LINE Developers Console](https://developers.line.biz)
2. สร้าง Channel ประเภท **LINE Login**
3. คัดลอก **Channel ID** และ **Channel Secret** ไปใส่ใน Environment Variables ของ Vercel (ฝั่ง Backend)
4. ไปที่เมนู LINE Login -> **Callback URL** แล้วใส่ URL ตัวอย่างดังนี้:
   - `https://your-frontend.vercel.app/auth/line/callback`
