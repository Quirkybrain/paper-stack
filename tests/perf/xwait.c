/*
 * xwait.c — minimal X11 window-appearance timer for the NF04 calibration
 * scripts (T-60). Prints milliseconds from invocation until a *substantial*
 * viewable window of the requested class exists: mapped, at least 200x200
 * pixels, largest area wins (mirrors the tests/desktop/xdo-helper selection;
 * GTK creates small or hidden helper windows with the same WM_CLASS before
 * the real toplevel is mapped). Test tooling only; never shipped (ADR-010).
 *
 * Build:
 *   cc -O2 tests/perf/xwait.c -lxdo -lX11 -o tests/perf/.bin/xwait
 *
 * Usage: xwait [class] [timeout_ms]   (default class "paperstack", 30 s)
 * Exit codes: 0 found, 1 timeout, 2 usage/connection failure.
 */

#define _POSIX_C_SOURCE 200809L

#include <X11/Xlib.h>
#include <xdo.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MIN_SIZE 200

static long long now_ms(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (long long)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static void sleep_ms(int ms)
{
    struct timespec ts;
    ts.tv_sec = ms / 1000;
    ts.tv_nsec = (long)(ms % 1000) * 1000000L;
    nanosleep(&ts, NULL);
}

int main(int argc, char **argv)
{
    const char *classname = (argc > 1) ? argv[1] : "paperstack";
    int timeout_ms = (argc > 2) ? atoi(argv[2]) : 30000;
    if (timeout_ms <= 0)
        timeout_ms = 30000;

    xdo_t *xdo = xdo_new(NULL);
    Display *dpy = XOpenDisplay(NULL);
    if (!xdo || !dpy) {
        fprintf(stderr, "xwait: cannot connect to the X display (DISPLAY=%s)\n",
                getenv("DISPLAY") ? getenv("DISPLAY") : "(unset)");
        return 2;
    }

    long long started = now_ms();
    for (;;) {
        xdo_search_t search;
        Window *wins = NULL;
        unsigned int count = 0;
        Window best = 0;
        unsigned long best_area = 0;
        unsigned int index;

        memset(&search, 0, sizeof(search));
        search.searchmask = SEARCH_CLASSNAME;
        search.winclassname = classname;
        search.max_depth = -1;
        search.only_visible = 1;
        search.require = SEARCH_ANY;
        search.limit = 0;
        if (xdo_search_windows(xdo, &search, &wins, &count) == 0 && wins) {
            for (index = 0; index < count; index++) {
                XWindowAttributes attr;
                unsigned long area;
                if (!XGetWindowAttributes(dpy, wins[index], &attr))
                    continue;
                if (attr.map_state != IsViewable)
                    continue;
                if (attr.width < MIN_SIZE || attr.height < MIN_SIZE)
                    continue;
                area = (unsigned long)attr.width * (unsigned long)attr.height;
                if (area > best_area) {
                    best_area = area;
                    best = wins[index];
                }
            }
            free(wins);
        }
        if (best != 0) {
            long long elapsed = now_ms() - started;
            printf("%lld 0x%lx\n", elapsed, (unsigned long)best);
            fflush(stdout);
            XCloseDisplay(dpy);
            xdo_free(xdo);
            return 0;
        }
        if (now_ms() - started > timeout_ms) {
            fprintf(stderr, "xwait: class '%s' has no viewable >= %dx%d window within %d ms\n",
                    classname, MIN_SIZE, MIN_SIZE, timeout_ms);
            XCloseDisplay(dpy);
            xdo_free(xdo);
            return 1;
        }
        sleep_ms(2);
    }
}
