# uncompyle6 version 3.9.3
# Python bytecode version base 2.3 (62021)
# Decompiled from: Python 3.11.15 (main, Jun 23 2026, 15:46:51) [Clang 22.1.3 ]
# Embedded file name: c:\python23\lib\site-packages\py2exe\boot_common.py
import sys
if sys.frozen == 'windows_exe':

    class Stderr(object):
        __module__ = __name__
        softspace = 0
        _file = None
        _error = None

        def write(self, text, alert=sys._MessageBox):
            if self._file is None and self._error is None:
                fname = sys.executable + '.log'
                try:
                    self._file = open(fname, 'a')
                except Exception, details:
                    self._error = details
                    import atexit
                    atexit.register(alert, 0, "The logfile '%s' could be opened:\n %s" % (fname, details), 'Errors occurred')
                else:
                    import atexit
                    atexit.register(alert, 0, "See the logfile '%s' for details" % fname, 'Errors occurred')
            if self._file is not None:
                self._file.write(text)
                self._file.flush()
            return


    sys.stderr = Stderr()
    del sys._MessageBox
    del Stderr

    class Blackhole(object):
        __module__ = __name__
        softspace = 0

        def write(self, text):
            return


    sys.stdout = Blackhole()
    del Blackhole
del sys
import linecache

def fake_getline(filename, lineno):
    return ''
    return


linecache.orig_getline = linecache.getline
linecache.getline = fake_getline
del linecache
del fake_getline
return
