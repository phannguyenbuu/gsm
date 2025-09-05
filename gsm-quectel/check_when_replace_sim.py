import win32file
import win32event
import win32con
import win32gui
import ctypes

def device_change_callback(hwnd, msg, wparam, lparam):
    if msg == win32con.WM_DEVICECHANGE:
        if wparam == win32con.DBT_DEVNODES_CHANGED:
            print("Device change detected (maybe SIM changed)")
            # Gửi AT+CNUM hoặc cập nhật lại trạng thái thiết bị tại đây
    return True

wc = win32gui.WNDCLASS()
hinst = wc.hInstance = win32gui.GetModuleHandle(None)
wc.lpszClassName = "DeviceChangeMonitor"
wc.lpfnWndProc = device_change_callback
classAtom = win32gui.RegisterClass(wc)
hwnd = win32gui.CreateWindow(wc.lpszClassName, "Device Change Monitor", 0, 0, 0, 0, 0, 0, 0, hinst, None)

print("Listening for device change events...")
win32gui.PumpMessages()
