import os
import shutil

def main():
    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    img_dir = os.path.join(base_dir, 'img')
    web_public_dir = os.path.join(base_dir, 'dashboard', 'public')
    desktop_dir = os.path.join(base_dir, 'desktop')
    
    # 1. Setup Web Assets
    print("Setting up web application icons...")
    if not os.path.exists(web_public_dir):
        os.makedirs(web_public_dir)
        print(f"Created directory: {web_public_dir}")
        
    for filename in os.listdir(img_dir):
        src = os.path.join(img_dir, filename)
        if os.path.isfile(src):
            dst = os.path.join(web_public_dir, filename)
            shutil.copy2(src, dst)
            print(f"  Copied {filename} -> dashboard/public/")
            
    # 2. Setup Worker Assets
    print("\nSetting up worker application icons...")
    worker_assets_dir = os.path.join(base_dir, 'worker', 'assets')
    if not os.path.exists(worker_assets_dir):
        os.makedirs(worker_assets_dir)
        print(f"Created directory: {worker_assets_dir}")

    # For Windows:
    if os.path.exists(os.path.join(img_dir, 'favicon.ico')):
        shutil.copy2(os.path.join(img_dir, 'favicon.ico'), os.path.join(worker_assets_dir, 'icon.ico'))
        print("  Copied favicon.ico -> worker/assets/icon.ico")
    
    # For Linux:
    if os.path.exists(os.path.join(img_dir, 'android-chrome-512x512.png')):
        shutil.copy2(os.path.join(img_dir, 'android-chrome-512x512.png'), os.path.join(worker_assets_dir, 'icon.png'))
        print("  Copied android-chrome-512x512.png -> worker/assets/icon.png")

    # For macOS (ideally needs .icns, but electron-builder can sometimes use PNG or fallback)
    # The user is instructed to generate icon.icns if doing a mac build.
    if os.path.exists(os.path.join(img_dir, 'icon.icns')):
        shutil.copy2(os.path.join(img_dir, 'icon.icns'), os.path.join(worker_assets_dir, 'icon.icns'))
        print("  Copied icon.icns -> worker/assets/icon.icns")
    else:
        print("  Warning: icon.icns not found in img/ folder! Mac build will need it.")

    print("\n✅ All icons have been successfully copied to their respective places!")

if __name__ == "__main__":
    main()
