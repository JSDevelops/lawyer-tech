import urllib.request
import ssl

def main():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    url = "https://backend-one-chi-45.vercel.app/"
    try:
        print(f"Requesting {url}...")
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
            print(f"Status: {response.status}")
            print(f"Headers: {dict(response.headers)}")
            print(f"Body: {response.read().decode('utf-8')[:200]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
