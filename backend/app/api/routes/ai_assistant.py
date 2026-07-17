"""AI Assistant Routes — Smart Legal Research, Case Summarization, Document Drafting"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from langchain.prompts import ChatPromptTemplate
from langchain.schema.output_parser import StrOutputParser
import io
import pypdf

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.ai import get_llm, get_genai_model

router = APIRouter()

# ==============================
# Pydantic Schemas
# ==============================

class LegalResearchRequest(BaseModel):
    question: str
    category: Optional[str] = None
    include_dika: bool = True


class SummarizeRequest(BaseModel):
    text: str
    output_format: str = "brief"  # brief, detailed, bullet


class DocumentDraftRequest(BaseModel):
    template_type: str  # complaint, contract, power_of_attorney
    client_name: str
    case_details: str
    additional_info: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[list] = []


async def check_and_deduct_ai_credits(db: AsyncSession, user_id: str):
    """ตรวจสอบสิทธิ์โควตา AI ของสำนักงานกฎหมาย และหักลบทีละ 1 เครดิตเมื่อเรียกใช้งานสำเร็จ"""
    import uuid as _uuid
    from app.models.models import User, Tenant
    
    try:
        user_uuid = _uuid.UUID(str(user_id))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="ไม่พบข้อมูลผู้ใช้")
        
    user_res = await db.execute(select(User).where(User.id == user_uuid))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลผู้ใช้")
        
    if not user.tenant_id:
        return None, None
        
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลสำนักงานกฎหมาย (Tenant)")
        
    # Initialize fields if None
    if tenant.ai_credits_total is None:
        tenant.ai_credits_total = 100
    if tenant.ai_credits_used is None:
        tenant.ai_credits_used = 0
    if tenant.ai_credits_remaining is None:
        tenant.ai_credits_remaining = tenant.ai_credits_total
        
    # Check remaining credits
    if tenant.ai_credits_remaining <= 0:
        raise HTTPException(
            status_code=403,
            detail="เครดิต AI ของสำนักงานกฎหมายท่านหมดลงแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อเติมเครดิต"
        )
        
    # Deduct credit
    tenant.ai_credits_used += 1
    tenant.ai_credits_remaining = max(0, tenant.ai_credits_total - tenant.ai_credits_used)
    
    await db.flush()
    await db.commit()
    
    return tenant.ai_credits_remaining, tenant.ai_credits_total


# ==============================
# API Endpoints
# ==============================

@router.post("/chat")
async def ai_chat(
    request: ChatRequest, 
    db: AsyncSession = Depends(get_db), 
    current_user=Depends(get_current_user)
):
    """🤖 AI Chat Assistant สำหรับทนายและลูกความ"""
    try:
        # Check and deduct credits
        credits_remaining, credits_total = await check_and_deduct_ai_credits(db, current_user["sub"])
        
        llm = await get_llm(db)
        
        system_prompt = """คุณคือ AI ผู้ช่วยทางกฎหมายของ Lawyer Tech ERP
คุณช่วยทีมทนายความในการ:
1. วิเคราะห์ข้อเท็จจริงของคดี
2. ค้นหาและอ้างอิงกฎหมายที่เกี่ยวข้อง
3. สรุปเอกสารทางกฎหมาย
4. ร่างเอกสารเบื้องต้น
5. ให้คำแนะนำด้านกระบวนการทางกฎหมายไทย

ตอบเป็นภาษาไทย กระชับ ชัดเจน และเป็นมืออาชีพ"""

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{message}")
        ])
        
        chain = prompt | llm | StrOutputParser()
        response = chain.invoke({"message": request.message})
        
        model_name = getattr(llm, "model_name", getattr(llm, "model", "AI Model"))
        return {
            "status": "success",
            "response": response,
            "model": model_name,
            "ai_credits_remaining": credits_remaining,
            "ai_credits_total": credits_total
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")


@router.post("/legal-research")
async def smart_legal_research(
    request: LegalResearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """🔎 Smart Legal Research — ค้นหากฎหมายและฎีกาที่เกี่ยวข้องด้วย RAG"""
    try:
        # Check and deduct credits
        credits_remaining, credits_total = await check_and_deduct_ai_credits(db, current_user["sub"])
        
        from app.models.models import LegalReference
        from app.core.ai import get_embedding
        
        # 1. Perform semantic search (RAG)
        references = []
        context = "ไม่มีข้อมูลประกอบฎีกาและมาตรากฎหมายอ้างอิงในฐานข้อมูล กรุณาตอบโดยใช้ความรู้กฎหมายทั่วไปของคุณ"
        
        try:
            query_vector = await get_embedding(request.question, db)
            stmt = select(LegalReference).order_by(
                LegalReference.embedding.cosine_distance(query_vector)
            ).limit(3)
            res = await db.execute(stmt)
            references = res.scalars().all()
            
            if references:
                context_parts = []
                for idx, ref in enumerate(references, 1):
                    context_parts.append(
                        f"[{idx}] {ref.title} ({ref.dika_number or ref.category})\n"
                        f"เนื้อหา: {ref.content}"
                    )
                context = "\n\n".join(context_parts)
        except Exception as embed_err:
            print(f"RAG search error (falling back to direct LLM): {embed_err}")
            
        llm = await get_llm(db)
        
        prompt_template = """คุณคือทนายความและผู้เชี่ยวชาญกฎหมายไทยที่มีความเชี่ยวชาญสูง 
หน้าที่ของคุณคือวิเคราะห์ข้อเท็จจริงของคดีความโดยอ้างอิงมาตรากฎหมายหรือแนวฎีกาที่ประกอบอยู่ใน Context ด้านล่างนี้ (ถ้ามี) เป็นหลัก

ข้อมูลกฎหมายและแนวฎีกาประกอบ (Context):
{context}

คำถาม/ข้อเท็จจริงคดี: {question}
หมวดคดี: {category}

กรุณาให้คำแนะนำทางกฎหมายอย่างละเอียดตามหัวข้อดังนี้:
1. **บทวิเคราะห์ตามข้อกฎหมายและแนวฎีกาที่เกี่ยวข้อง** — นำข้อมูลจาก Context ด้านบนมาประยุก้และอ้างอิงอย่างชัดเจน
2. **ประเมินความเป็นไปได้ทางคดีความ** — โอกาสชนะ/แพ้คดี หรือความเสี่ยงต่างๆ
3. **แนวทางการดำเนินการต่อสำหรับทนายความ** — ขั้นตอนและคำแนะนำที่เป็นรูปธรรม
4. **ข้อควรระวังสำคัญ**

ตอบเป็นภาษาไทยอย่างเป็นทางการ กระชับ ชัดเจน และมีหลักวิชาการทางกฎหมาย"""

        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm | StrOutputParser()
        
        result = chain.invoke({
            "context": context,
            "question": request.question,
            "category": request.category or "ทั่วไป"
        })
        
        return {
            "status": "success",
            "research_result": result,
            "question": request.question,
            "category": request.category,
            "ai_credits_remaining": credits_remaining,
            "ai_credits_total": credits_total,
            "references": [
                {
                    "dika_number": ref.dika_number,
                    "title": ref.title,
                    "content": ref.content,
                    "category": ref.category,
                    "year": ref.year,
                    "court_level": ref.court_level,
                    "source_url": ref.source_url
                } for ref in references
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seed-references")
async def seed_legal_references(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Seed sample Supreme Court judgments and Civil/Penal code sections with Embeddings"""
    from app.models.models import LegalReference
    from app.core.ai import get_embedding
    
    # Check if there are already references to avoid duplicate seeding
    check_stmt = select(func.count(LegalReference.id))
    check_res = await db.execute(check_stmt)
    count = check_res.scalar() or 0
    if count > 0:
        return {"status": "success", "message": f"Database already has {count} legal references. Seeding skipped."}
        
    # Sample Thai legal references
    sample_data = [
        {
            "dika_number": "ฎีกาที่ 1234/2565",
            "title": "กู้ยืมเงินผ่านทางแอปพลิเคชัน LINE ถือเป็นหนังสือสัญญากู้ยืมตามกฎหมาย",
            "content": "การกู้ยืมเงินมีหลักฐานการส่งข้อความโต้ตอบกันทางแอปพลิเคชัน LINE และหลักฐานการโอนเงินผ่านระบบธนาคารอิเล็กทรอนิกส์ (e-Banking) ถือเป็นหนังสือสัญญากู้ยืมเงินที่เป็นลายลักษณ์อักษรตาม พ.ร.บ.ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544 มาตรา 7 และมาตรา 8 ร่วมกับ ป.พ.พ. มาตรา 653 โจทก์มีสิทธิ์ฟ้องร้องบังคับคดีได้ตามกฎหมาย แม้จะไม่มีการลงลายมือชื่อในกระดาษก็ตาม",
            "category": "คดีแพ่ง",
            "year": 2565,
            "court_level": "ศาลฎีกา",
            "tags": ["กู้ยืมเงิน", "LINE", "หลักฐานออนไลน์", "ธุรกรรมอิเล็กทรอนิกส์"],
            "source_url": "https://www.coj.go.th"
        },
        {
            "dika_number": "ฎีกาที่ 5678/2566",
            "title": "สิทธิ์ในการขอเปิดทางจำเป็นเมื่อที่ดินถูกล้อมรอบจนไม่มีทางออก",
            "content": "ที่ดินของโจทก์ถูกล้อมรอบด้วยที่ดินของจำเลยและบุคคลอื่นจนไม่มีทางออกสู่ทางสาธารณะ โจทก์ย่อมมีสิทธิ์ขอผ่านที่ดินที่ล้อมอยู่ไปสู่ทางสาธารณะได้ตาม ป.พ.พ. มาตรา 1349 โดยไม่จำเป็นต้องเป็นกรณีที่ถูกล้อมร้อยเปอร์เซ็นต์ หากทางออกอื่นที่มีอยู่เดิมเป็นหนองน้ำหรือเหวลึกที่ไม่สามารถสัญจรได้สะดวก ก็ถือว่าเป็นทางจำเป็น และโจทก์ต้องจ่ายค่าทดแทนการใช้ทางให้แก่จำเลยตามสมควร",
            "category": "ที่ดิน",
            "year": 2566,
            "court_level": "ศาลฎีกา",
            "tags": ["ที่ดิน", "ทางจำเป็น", "ทางสาธารณะ", "ภาระจำยอม"],
            "source_url": "https://www.coj.go.th"
        },
        {
            "dika_number": "ฎีกาที่ 9101/2564",
            "title": "อายุความฟ้องร้องเรียกเงินตามบัตรเครดิตมีกำหนด 2 ปี",
            "content": "สิทธิเรียกร้องของธนาคารผู้ออกบัตรเครดิตในการฟ้องร้องให้ผู้ถือบัตรชำระหนี้ค่าสินค้าหรือบริการ รวมถึงการเบิกถอนเงินสดล่วงหน้า มีอายุความ 2 ปีตาม ป.พ.พ. มาตรา 193/34 (7) ซึ่งเป็นหนี้อันเกิดจากการค้าขายหรือบริการของสถาบันการเงิน โดยอายุความเริ่มนับตั้งแต่วันที่ครบกำหนดชำระเงินที่ผู้บริโภคผิดนัดชำระหนี้ครั้งล่าสุด หรือนับแต่วันชำระหนี้ครั้งสุดท้าย",
            "category": "คดีผิดสัญญา",
            "year": 2564,
            "court_level": "ศาลฎีกา",
            "tags": ["บัตรเครดิต", "อายุความ", "หนี้สิน", "ผิดสัญญา"],
            "source_url": "https://www.coj.go.th"
        },
        {
            "dika_number": "ป.พ.พ. มาตรา 653",
            "title": "หลักฐานการกู้ยืมเงิน",
            "content": "การกู้ยืมเงินกว่าสองพันบาทขึ้นไปนั้น ถ้ามิได้มีหลักฐานเป็นหนังสืออย่างใดอย่างหนึ่งลงลายมือชื่อผู้ยืมเป็นสำคัญ จะฟ้องร้องบังคับคดีไม่ได้ ในการกู้ยืมเงินมีหลักฐานเป็นหนังสือนี้ ท่านว่าจะนำสืบการใช้เงินได้ต่อเมื่อมีหลักฐานเป็นหนังสืออย่างใดอย่างหนึ่งลงลายมือชื่อผู้ให้กู้มาแสดง หรือเอกสารอันเป็นหลักฐานแห่งการกู้ยืมนั้นได้เวนคืนแล้ว หรือได้แทงเพิกถอนลงในเอกสารนั้นแล้ว",
            "category": "คดีแพ่ง",
            "year": 2535,
            "court_level": "ประมวลกฎหมายแพ่งและพาณิชย์",
            "tags": ["กู้ยืมเงิน", "หลักฐานเป็นหนังสือ", "กฎหมายแพ่ง"],
            "source_url": "https://www.krisdika.go.th"
        },
        {
            "dika_number": "ป.พ.พ. มาตรา 1349",
            "title": "การขอผ่านที่ดินแปลงอื่นเพื่อออกสู่ทางสาธารณะ (ทางจำเป็น)",
            "content": "ที่ดินแปลงใดมีที่ดินแปลงอื่นล้อมอยู่จนไม่มีทางออกถึงทางสาธารณะได้ไซร้ ท่านว่าเจ้าของที่ดินแปลงนั้นจะผ่านที่ดินที่ล้อมอยู่ไปสู่ทางสาธารณะได้ ที่ดินแปลงใดมีทางออกถึงทางสาธารณะได้ แต่ต้องข้ามสระ บึง หรือทะเล หรือมีที่ชันอันระดับที่ดินกับทางสาธารณะสูงต่ำกว่ากันมากไซร้ ท่านว่าให้อ้างใช้ความในวรรคต้นได้ แต่ผู้ผ่านต้องเสียค่าทดแทนให้แก่เจ้าของที่ดินที่ล้อมอยู่เพื่อความเสียหายอันเกิดแต่เหตุที่มีทางผ่านนั้น",
            "category": "ที่ดิน",
            "year": 2535,
            "court_level": "ประมวลกฎหมายแพ่งและพาณิชย์",
            "tags": ["ที่ดิน", "ทางจำเป็น", "กฎหมายที่ดิน"],
            "source_url": "https://www.krisdika.go.th"
        },
        {
            "dika_number": "ป.อ. มาตรา 334",
            "title": "ความผิดฐานลักทรัพย์",
            "content": "ผู้ใดเอาทรัพย์ของผู้อื่น หรือที่ผู้อื่นเป็นเจ้าของรวมอยู่ด้วยไปโดยทุจริต ผู้นั้นกระทำความผิดฐานลักทรัพย์ ต้องระวางโทษจำคุกไม่เกินสามปี และปรับไม่เกินหกหมื่นบาท ซึ่งเป็นองค์ประกอบพื้นฐานของคดีเกี่ยวกับทรัพย์ในทางอาญา",
            "category": "คดีอาญา",
            "year": 2499,
            "court_level": "ประมวลกฎหมายอาญา",
            "tags": ["ลักทรัพย์", "คดีอาญา", "ความผิดเกี่ยวกับทรัพย์"],
            "source_url": "https://www.krisdika.go.th"
        },
        {
            "dika_number": "ฎีกาที่ 444/2563",
            "title": "การบอกเลิกสัญญาจ้างแรงงานโดยไม่มีความผิดของลูกจ้าง ต้องบอกกล่าวล่วงหน้า",
            "content": "การบอกเลิกสัญญาจ้างแรงงานที่ไม่มีกำหนดระยะเวลา นายจ้างสามารถบอกเลิกสัญญาได้โดยการบอกกล่าวล่วงหน้าเป็นหนังสือให้อีกฝ่ายหนึ่งทราบเมื่อถึงหรือก่อนจะถึงกำหนดจ่ายสินจ้างคราวใดคราวหนึ่ง เพื่อให้เป็นผลเลิกสัญญากันเมื่อถึงกำหนดจ่ายสินจ้างคราวถัดไปข้างหน้าตาม ป.พ.พ. มาตรา 582 หากนายจ้างเลิกจ้างทันทีโดยไม่ได้บอกกล่าวล่วงหน้าและลูกจ้างไม่ได้กระทำความผิดร้ายแรง นายจ้างต้องจ่ายค่าสินจ้างแทนการบอกกล่าวล่วงหน้า (ค่าตกใจ)",
            "category": "คดีแรงงาน",
            "year": 2563,
            "court_level": "ศาลฎีกา",
            "tags": ["เลิกจ้าง", "บอกกล่าวล่วงหน้า", "กฎหมายแรงงาน", "ค่าตกใจ"],
            "source_url": "https://www.coj.go.th"
        },
        {
            "dika_number": "ป.พ.พ. มาตรา 1564",
            "title": "หน้าที่อุปการะเลี้ยงดูบุตร",
            "content": "บิดามารดามีหน้าที่ร่วมกันอุปการะเลี้ยงดูและให้การศึกษาตามสมควรแก่บุตรในระหว่างที่เป็นผู้เยาว์ และมีหน้าที่อุปการะเลี้ยงดูบุตรซึ่งบรรลุนิติภาวะแล้วแต่เฉพาะผู้ทุพพลภาพและหาเลี้ยงตนเองมิได้ การฝ่าฝืนหน้าที่นี้ ทายาทย่อมสามารถฟ้องร้องเรียกค่าอุปการะเลี้ยงดูย้อนหลังได้",
            "category": "คดีครอบครัว",
            "year": 2535,
            "court_level": "ประมวลกฎหมายแพ่งและพาณิชย์",
            "tags": ["ครอบครัว", "เลี้ยงดูบุตร", "บุตรผู้เยาว์"],
            "source_url": "https://www.krisdika.go.th"
        }
    ]
    
    # Save with embeddings
    added_count = 0
    for item in sample_data:
        try:
            # Combine dika_number, title, and content for a rich embedding context
            embedding_text = f"{item['dika_number']} {item['title']}: {item['content']}"
            vector = await get_embedding(embedding_text, db)
            
            ref = LegalReference(
                dika_number=item["dika_number"],
                title=item["title"],
                content=item["content"],
                category=item["category"],
                year=item["year"],
                court_level=item["court_level"],
                tags=item["tags"],
                source_url=item["source_url"],
                embedding=vector
            )
            db.add(ref)
            added_count += 1
        except Exception as e:
            print(f"Error seeding reference {item['dika_number']}: {e}")
            
    await db.flush()
    return {"status": "success", "message": f"Successfully seeded {added_count} legal references with embeddings."}


@router.get("/search-references")
async def search_legal_references(
    q: str = Query(..., min_length=2),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Semantic vector search for legal references"""
    from app.models.models import LegalReference
    from app.core.ai import get_embedding
    
    try:
        query_vector = await get_embedding(q, db)
        # Cosine distance similarity search
        stmt = select(LegalReference).order_by(
            LegalReference.embedding.cosine_distance(query_vector)
        ).limit(limit)
        res = await db.execute(stmt)
        references = res.scalars().all()
        
        return {
            "status": "success",
            "query": q,
            "results": [
                {
                    "id": str(ref.id),
                    "dika_number": ref.dika_number,
                    "title": ref.title,
                    "content": ref.content,
                    "category": ref.category,
                    "year": ref.year,
                    "court_level": ref.court_level,
                    "tags": ref.tags,
                    "source_url": ref.source_url
                } for ref in references
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search Error: {str(e)}")


@router.post("/summarize")
async def summarize_case(
    request: SummarizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """📝 Case Summarization — สรุปข้อเท็จจริงคดีเป็น 1 หน้า"""
    try:
        # Check and deduct credits
        credits_remaining, credits_total = await check_and_deduct_ai_credits(db, current_user["sub"])
        
        llm = await get_llm(db)
        
        format_instructions = {
            "brief": "สรุปกระชับใน 3-5 ประโยค",
            "detailed": "สรุปอย่างละเอียด แบ่งเป็นหัวข้อ: ข้อเท็จจริง, ประเด็นทางกฎหมาย, สิ่งที่ต้องดำเนินการ",
            "bullet": "สรุปเป็น bullet points แยกหัวข้อชัดเจน"
        }
        
        prompt_template = """สรุปข้อเท็จจริงทางกฎหมายต่อไปนี้:

{text}

{format_instruction}

เน้น: ข้อเท็จจริงสำคัญ, ประเด็นทางกฎหมาย, สิทธิและหน้าที่ของคู่กรณี"""

        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm | StrOutputParser()
        
        result = chain.invoke({
            "text": request.text,
            "format_instruction": format_instructions.get(request.output_format, format_instructions["brief"])
        })
        
        return {
            "status": "success",
            "summary": result,
            "format": request.output_format,
            "original_length": len(request.text),
            "summary_length": len(result),
            "ai_credits_remaining": credits_remaining,
            "ai_credits_total": credits_total
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/summarize-pdf")
async def summarize_pdf(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """📄 PDF Summarization — อัปโหลด PDF และให้ AI สรุป"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="รองรับเฉพาะไฟล์ PDF")
    
    try:
        # Check and deduct credits
        credits_remaining, credits_total = await check_and_deduct_ai_credits(db, current_user["sub"])
        
        contents = await file.read()
        pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
        
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="ไม่สามารถอ่านข้อความจาก PDF ได้")
        
        llm = await get_llm(db)
        
        prompt_template = """สรุปเนื้อหาเอกสารทางกฎหมายต่อไปนี้เป็น 1 หน้า A4:

{text}

สรุปโดย:
1. ชื่อ/ประเภทเอกสาร
2. คู่กรณี (ถ้ามี)
3. ประเด็นหลักสำคัญ
4. ข้อกำหนด/เงื่อนไขสำคัญ
5. วันที่และกำหนดเวลาสำคัญ
6. ข้อควรระวัง"""

        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm | StrOutputParser()
        
        # ถ้าข้อความยาวเกินไป ใช้แค่ 10,000 ตัวอักษรแรก
        text_to_analyze = text[:10000] if len(text) > 10000 else text
        
        result = chain.invoke({"text": text_to_analyze})
        
        return {
            "status": "success",
            "filename": file.filename,
            "pages": len(pdf_reader.pages),
            "summary": result,
            "extracted_chars": len(text),
            "ai_credits_remaining": credits_remaining,
            "ai_credits_total": credits_total
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/draft-document")
async def draft_document(
    request: DocumentDraftRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """📃 Document Drafting — ร่างเอกสารทางกฎหมายด้วย AI"""
    try:
        # Check and deduct credits
        credits_remaining, credits_total = await check_and_deduct_ai_credits(db, current_user["sub"])
        
        llm = await get_llm(db)
        
        templates = {
            "complaint": "คำฟ้องต่อศาล",
            "contract": "สัญญา",
            "power_of_attorney": "หนังสือมอบอำนาจ",
            "demand_letter": "จดหมายทวงถาม",
            "appeal": "อุทธรณ์",
        }
        
        doc_type = templates.get(request.template_type, request.template_type)
        
        prompt_template = """ร่าง{doc_type}สำหรับ:

ชื่อลูกความ: {client_name}
ข้อเท็จจริงคดี: {case_details}
ข้อมูลเพิ่มเติม: {additional_info}

กรุณาร่างเอกสารในรูปแบบทางการ ถูกต้องตามกฎหมายไทย มีหัวข้อและโครงสร้างที่เหมาะสม
หมายเหตุ: นี่เป็นเพียงร่างเบื้องต้น ทนายความต้องตรวจสอบและแก้ไขก่อนใช้งานจริง"""

        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm | StrOutputParser()
        
        result = chain.invoke({
            "doc_type": doc_type,
            "client_name": request.client_name,
            "case_details": request.case_details,
            "additional_info": request.additional_info or "-"
        })
        
        return {
            "status": "success",
            "document_type": doc_type,
            "client_name": request.client_name,
            "draft_content": result,
            "disclaimer": "เอกสารนี้เป็นเพียงร่างเบื้องต้น ต้องผ่านการตรวจสอบจากทนายความก่อนใช้งาน",
            "ai_credits_remaining": credits_remaining,
            "ai_credits_total": credits_total
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/categorize-case")
async def categorize_case(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """🏷️ จัดหมวดหมู่คดีอัตโนมัติด้วย AI"""
    try:
        # Check and deduct credits
        credits_remaining, credits_total = await check_and_deduct_ai_credits(db, current_user["sub"])
        
        model = await get_genai_model(db)
        
        prompt = f"""จากข้อความต่อไปนี้ จัดหมวดหมู่คดีความให้ตรงที่สุด โดยเลือกจาก:
- คดีอาญา
- คดีแพ่ง  
- จัดการมรดก
- ที่ดิน
- คดี พ.ร.บ. และอุบัติเหตุ
- คดียึดทรัพย์
- คดีผิดสัญญา
- คดีครอบครัว
- คดีแรงงาน
- คดีธุรกิจ

ตอบเฉพาะชื่อหมวดหมู่เท่านั้น ไม่ต้องอธิบาย

ข้อความ: {request.message}"""

        response = model.generate_content(prompt)
        category = response.text.strip()
        
        return {
            "status": "success",
            "category": category,
            "input": request.message,
            "ai_credits_remaining": credits_remaining,
            "ai_credits_total": credits_total
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
