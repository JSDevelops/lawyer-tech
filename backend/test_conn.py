import asyncio
import asyncpg
import sys

async def main():
    # Test combinations
    tests = [
        {
            "name": "Pooler with user.ref and url-encoded password",
            "dsn": "postgresql://postgres.acrvqdmmwodwfkfrdoiz:Samchai%23260225@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
        },
        {
            "name": "Pooler with user.ref and plain password",
            "dsn": "postgresql://postgres.acrvqdmmwodwfkfrdoiz:Samchai#260225@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
        },
        {
            "name": "Direct host with plain user and url-encoded password",
            "dsn": "postgresql://postgres:Samchai%23260225@db.acrvqdmmwodwfkfrdoiz.supabase.co:5432/postgres"
        },
        {
            "name": "Direct host with plain user and plain password",
            "dsn": "postgresql://postgres:Samchai#260225@db.acrvqdmmwodwfkfrdoiz.supabase.co:5432/postgres"
        },
        {
            "name": "Vercel-generated password from screenshot on direct host",
            "dsn": "postgresql://postgres:FcGCi9n500vKn3cc@db.acrvqdmmwodwfkfrdoiz.supabase.co:5432/postgres"
        },
        {
            "name": "Vercel-generated password on pooler host",
            "dsn": "postgresql://postgres.acrvqdmmwodwfkfrdoiz:FcGCi9n500vKn3cc@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
        }
    ]

    for t in tests:
        print(f"Testing: {t['name']}...")
        try:
            conn = await asyncio.wait_for(asyncpg.connect(t['dsn']), timeout=5.0)
            await conn.close()
            print(f"✅ SUCCESS: {t['name']}")
            print(f"Correct DSN to use: {t['dsn'].replace('postgresql://', 'postgresql+asyncpg://')}")
            sys.exit(0)
        except Exception as e:
            print(f"❌ FAILED: {type(e).__name__}: {e}\n")

if __name__ == "__main__":
    asyncio.run(main())
