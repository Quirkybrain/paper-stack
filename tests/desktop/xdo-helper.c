/*
 * xdo-helper.c — PaperStack test-only desktop input helper (wp-21 / T-36).
 *
 * Purpose: drive the real PaperStack GTK/WebKitGTK window on X11 for the
 * EA-RUN fixed-condition checks (ADR-010 "real app + scripted input +
 * screenshots"). This binary is test tooling only and MUST NOT be shipped in
 * the application bundle (ADR-010 Constraints; implementation plan §4.4).
 *
 * Why direct libxdo linking: this host has /usr/include/xdo.h and
 * libxdo.so.3 but no libxdo.pc, so pkg-config cannot be used. Build with:
 *
 *   cc -O2 tests/desktop/xdo-helper.c -lxdo -lX11 -o tests/desktop/xdo-helper
 *
 * Safety: before injecting keys the helper activates/focuses the target
 * window and verifies that the X input focus is the target window or one of
 * its descendants. If that verification fails, no keys are sent (so stray
 * XTEST events cannot reach unrelated user windows).
 *
 * Commands (class defaults to "paperstack", the app window instance name):
 *   list     [class]                         list matching windows
 *   find     [class]                         print hex window id
 *   geometry [class]                         print id/x/y/w/h/viewable
 *   focus    [class]                         activate, focus and verify input focus
 *   key      <keyseq> [class]                verify focus, send XTEST key sequence
 *   resize   <w> <h> [class]                 resize window, wait for the request
 *   click    <x> <y> [button] [count] [class] XTEST click at window-relative coords
 *   close    [class]                         ask the WM to close (WM_DELETE_WINDOW)
 *   wait     [class]                         wait (up to 60s) for the window to appear
 *
 * Exit codes: 0 ok; 2 usage; 1 window not found; 4 focus/operation failed;
 *             5 resize did not reach the requested size.
 */

#define _POSIX_C_SOURCE 200809L

#include <X11/Xatom.h>
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <xdo.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define DEFAULT_CLASS "paperstack"
#define FOCUS_TIMEOUT_MS 3000
#define RESIZE_TIMEOUT_MS 3000
#define WAIT_WINDOW_TIMEOUT_MS 60000

static xdo_t *xdo = NULL;
static Display *dpy = NULL;

static void sleep_ms(int ms)
{
    struct timespec ts;
    ts.tv_sec = ms / 1000;
    ts.tv_nsec = (long)(ms % 1000) * 1000000L;
    nanosleep(&ts, NULL);
}

static void die(const char *msg)
{
    fprintf(stderr, "xdo-helper: %s\n", msg);
    if (xdo)
        xdo_free(xdo);
    if (dpy)
        XCloseDisplay(dpy);
    exit(4);
}

static const char *arg_class(int argc, char **argv, int index)
{
    return (argc > index) ? argv[index] : DEFAULT_CLASS;
}

static Window find_window(const char *classname)
{
    xdo_search_t search;
    Window *wins = NULL;
    unsigned int n = 0;
    Window best = 0;
    unsigned long best_area = 0;
    unsigned int i;

    memset(&search, 0, sizeof(search));
    search.searchmask = SEARCH_CLASSNAME;
    search.winclassname = classname;
    search.max_depth = -1; /* whole tree */
    search.only_visible = 1;
    search.require = SEARCH_ANY;
    search.limit = 0;

    if (xdo_search_windows(xdo, &search, &wins, &n) != 0 || wins == NULL)
        return 0;

    for (i = 0; i < n; i++) {
        XWindowAttributes attr;
        unsigned long area;
        if (!XGetWindowAttributes(dpy, wins[i], &attr))
            continue;
        if (attr.map_state != IsViewable)
            continue;
        area = (unsigned long)attr.width * (unsigned long)attr.height;
        if (area > best_area) {
            best_area = area;
            best = wins[i];
        }
    }
    free(wins);
    return best;
}

static int is_ancestor_or_self(Window ancestor, Window w)
{
    int hops = 0;
    while (w != 0 && hops++ < 64) {
        if (w == ancestor)
            return 1;
        {
            Window root = 0, parent = 0, *children = NULL;
            unsigned int nchildren = 0;
            if (!XQueryTree(dpy, w, &root, &parent, &children, &nchildren))
                return 0;
            if (children)
                XFree(children);
            if (parent == w || parent == 0)
                return 0;
            w = parent;
        }
    }
    return 0;
}

static Window input_focus(void)
{
    Window focus = 0;
    int revert = 0;
    XGetInputFocus(dpy, &focus, &revert);
    return focus;
}

static int focus_verified(Window target)
{
    int waited = 0;
    while (waited <= FOCUS_TIMEOUT_MS) {
        Window focus = input_focus();
        if (focus == target || is_ancestor_or_self(target, focus))
            return 1;
        sleep_ms(50);
        waited += 50;
    }
    return 0;
}

static Window activate_and_verify(Window target)
{
    if (target == 0)
        die("target window not found");
    xdo_activate_window(xdo, target);
    xdo_focus_window(xdo, target);
    if (!focus_verified(target)) {
        fprintf(stderr,
                "xdo-helper: input focus is neither 0x%lx nor a descendant; "
                "refusing to send input (focused=0x%lx)\n",
                (unsigned long)target, (unsigned long)input_focus());
        exit(4);
    }
    return target;
}

static int cmd_wait(const char *classname)
{
    int waited = 0;
    while (waited <= WAIT_WINDOW_TIMEOUT_MS) {
        Window w = find_window(classname);
        if (w != 0) {
            printf("0x%lx\n", (unsigned long)w);
            fflush(stdout);
            return 0;
        }
        sleep_ms(250);
        waited += 250;
    }
    fprintf(stderr, "xdo-helper: window class '%s' not found within %dms\n",
            classname, WAIT_WINDOW_TIMEOUT_MS);
    return 1;
}

static int cmd_focus(const char *classname)
{
    Window target = find_window(classname);
    activate_and_verify(target);
    printf("focused 0x%lx\n", (unsigned long)target);
    return 0;
}

static int cmd_key(const char *keyseq, const char *classname)
{
    Window target = find_window(classname);
    activate_and_verify(target);
    sleep_ms(150);
    if (xdo_send_keysequence_window(xdo, CURRENTWINDOW, keyseq, 12000) != 0) {
        fprintf(stderr, "xdo-helper: failed to send key sequence '%s'\n", keyseq);
        return 4;
    }
    sleep_ms(150);
    printf("sent keyseq '%s' to 0x%lx\n", keyseq, (unsigned long)target);
    return 0;
}

static int cmd_resize(int width, int height, const char *classname)
{
    Window target = find_window(classname);
    unsigned int w = 0, h = 0;
    int waited = 0;

    if (target == 0)
        die("target window not found");
    if (xdo_set_window_size(xdo, target, width, height, 0) != 0) {
        fprintf(stderr, "xdo-helper: resize request failed\n");
        return 4;
    }
    for (;;) {
        if (xdo_get_window_size(xdo, target, &w, &h) == 0 &&
            (int)w == width && (int)h == height)
            break;
        if (waited > RESIZE_TIMEOUT_MS) {
            fprintf(stderr,
                    "xdo-helper: resize requested %dx%d but window is %ux%u "
                    "after %dms\n",
                    width, height, w, h, RESIZE_TIMEOUT_MS);
            return 5;
        }
        sleep_ms(100);
        waited += 100;
    }
    printf("resized 0x%lx to %ux%u (requested %dx%d)\n", (unsigned long)target,
           w, h, width, height);
    return 0;
}

static int cmd_click(int x, int y, int button, int count, const char *classname)
{
    Window target = find_window(classname);
    if (target == 0)
        die("target window not found");
    if (xdo_move_mouse_relative_to_window(xdo, target, x, y) != 0) {
        fprintf(stderr, "xdo-helper: failed to move pointer\n");
        return 4;
    }
    sleep_ms(50);
    if (xdo_click_window_multiple(xdo, CURRENTWINDOW, button, count, 15000) != 0) {
        fprintf(stderr, "xdo-helper: click failed\n");
        return 4;
    }
    sleep_ms(150);
    printf("clicked 0x%lx at (%d,%d) button %d count %d\n",
           (unsigned long)target, x, y, button, count);
    return 0;
}

static int cmd_close(const char *classname)
{
    Window target = find_window(classname);
    XEvent event;
    Atom wm_protocols, wm_delete;
    Status sent;

    if (target == 0)
        die("target window not found");

    /*
     * Send a synthetic WM_DELETE_WINDOW ClientMessage. libxdo's
     * xdo_close_window was measured not to close GTK/xclock windows on this
     * host (XSendEvent path), so the protocol request is issued directly.
     */
    wm_protocols = XInternAtom(dpy, "WM_PROTOCOLS", False);
    wm_delete = XInternAtom(dpy, "WM_DELETE_WINDOW", False);
    if (wm_protocols == None || wm_delete == None) {
        fprintf(stderr, "xdo-helper: failed to resolve WM_PROTOCOLS/WM_DELETE_WINDOW\n");
        return 4;
    }
    memset(&event, 0, sizeof(event));
    event.xclient.type = ClientMessage;
    event.xclient.send_event = True;
    event.xclient.display = dpy;
    event.xclient.window = target;
    event.xclient.message_type = wm_protocols;
    event.xclient.format = 32;
    event.xclient.data.l[0] = (long)wm_delete;
    event.xclient.data.l[1] = CurrentTime;
    sent = XSendEvent(dpy, target, False, NoEventMask, &event);
    XSync(dpy, False);
    if (!sent) {
        fprintf(stderr, "xdo-helper: WM_DELETE_WINDOW could not be sent\n");
        return 4;
    }
    printf("WM_DELETE_WINDOW sent to 0x%lx\n", (unsigned long)target);
    return 0;
}

static int cmd_geometry(const char *classname)
{
    Window target = find_window(classname);
    XWindowAttributes attr;
    int x = 0, y = 0;

    if (target == 0) {
        fprintf(stderr, "xdo-helper: window class '%s' not found\n", classname);
        return 1;
    }
    if (!XGetWindowAttributes(dpy, target, &attr))
        die("failed to read window attributes");
    xdo_get_window_location(xdo, target, &x, &y, NULL);
    printf("id=0x%lx x=%d y=%d w=%d h=%d viewable=%d\n", (unsigned long)target,
           x, y, attr.width, attr.height,
           attr.map_state == IsViewable ? 1 : 0);
    return 0;
}

/* Diagnostic title fetch; WM_NAME may be UTF8_STRING (app title includes CJK). */
static void print_window_line(Window w)
{
    XWindowAttributes attr;
    XTextProperty tp;
    char *title = NULL;

    if (!XGetWindowAttributes(dpy, w, &attr))
        return;
    if (XGetWMName(dpy, w, &tp) && tp.value) {
        char **list = NULL;
        int n = 0;
        if (Xutf8TextPropertyToTextList(dpy, &tp, &list, &n) >= 0 && n > 0 && list) {
            title = strdup(list[0]);
        } else if (tp.encoding == XA_STRING) {
            title = strdup((char *)tp.value);
        }
        if (list)
            XFreeStringList(list);
        if (tp.value)
            XFree(tp.value);
    }
    printf("0x%lx %ux%u %s\n", (unsigned long)w, (unsigned)attr.width,
           (unsigned)attr.height, title ? title : "(untitled)");
    free(title);
}

static int cmd_list(const char *classname)
{
    xdo_search_t search;
    Window *wins = NULL;
    unsigned int n = 0, i;

    memset(&search, 0, sizeof(search));
    search.searchmask = SEARCH_CLASSNAME;
    search.winclassname = classname;
    search.max_depth = -1;
    search.only_visible = 1;
    search.require = SEARCH_ANY;
    search.limit = 0;
    if (xdo_search_windows(xdo, &search, &wins, &n) != 0 || wins == NULL) {
        fprintf(stderr, "xdo-helper: search failed\n");
        return 1;
    }
    if (n == 0)
        printf("(no windows with classname '%s')\n", classname);
    for (i = 0; i < n; i++)
        print_window_line(wins[i]);
    free(wins);
    return 0;
}

static void usage(const char *argv0)
{
    fprintf(stderr,
            "usage: %s <list|find|geometry|focus|wait|close> [class]\n"
            "       %s key <keyseq> [class]\n"
            "       %s resize <w> <h> [class]\n"
            "       %s click <x> <y> [button] [count] [class]\n"
            "class defaults to '%s'\n",
            argv0, argv0, argv0, argv0, DEFAULT_CLASS);
    exit(2);
}

int main(int argc, char **argv)
{
    const char *cmd;

    if (argc < 2)
        usage(argv[0]);
    cmd = argv[1];

    dpy = XOpenDisplay(NULL);
    if (!dpy) {
        fprintf(stderr, "xdo-helper: cannot open DISPLAY '%s'\n",
                getenv("DISPLAY") ? getenv("DISPLAY") : "(unset)");
        return 4;
    }
    xdo = xdo_new(NULL);
    if (!xdo) {
        fprintf(stderr, "xdo-helper: xdo_new failed\n");
        XCloseDisplay(dpy);
        return 4;
    }

    if (strcmp(cmd, "list") == 0)
        return cmd_list(arg_class(argc, argv, 2));
    if (strcmp(cmd, "find") == 0)
        return find_window(arg_class(argc, argv, 2)) ? 0 : 1;
    if (strcmp(cmd, "geometry") == 0)
        return cmd_geometry(arg_class(argc, argv, 2));
    if (strcmp(cmd, "focus") == 0)
        return cmd_focus(arg_class(argc, argv, 2));
    if (strcmp(cmd, "wait") == 0)
        return cmd_wait(arg_class(argc, argv, 2));
    if (strcmp(cmd, "close") == 0)
        return cmd_close(arg_class(argc, argv, 2));
    if (strcmp(cmd, "key") == 0) {
        if (argc < 3)
            usage(argv[0]);
        return cmd_key(argv[2], arg_class(argc, argv, 3));
    }
    if (strcmp(cmd, "resize") == 0) {
        if (argc < 4)
            usage(argv[0]);
        return cmd_resize(atoi(argv[2]), atoi(argv[3]), arg_class(argc, argv, 4));
    }
    if (strcmp(cmd, "click") == 0) {
        int button = (argc > 4) ? atoi(argv[4]) : 1;
        int count = (argc > 5) ? atoi(argv[5]) : 1;
        if (argc < 4)
            usage(argv[0]);
        return cmd_click(atoi(argv[2]), atoi(argv[3]), button, count,
                         arg_class(argc, argv, 6));
    }
    usage(argv[0]);
    return 2;
}
