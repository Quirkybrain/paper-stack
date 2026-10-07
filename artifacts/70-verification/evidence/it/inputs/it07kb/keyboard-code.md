# Code blocks (rendering-pipeline §2.9)

Supported languages (first batch, 12): C, C++, Python, Rust, Java, JavaScript,
TypeScript, Bash, JSON, YAML, SQL and plain text.

```c
int main(void) { return 0; }
```

```cpp
auto answer = 42; // C++
```

```python
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)
```

```rust
fn main() { println!("你好"); }
```

```java
class Main { public static void main(String[] a) {} }
```

```javascript
export const add = (a, b) => a + b
```

```typescript
const n: number = 1 satisfies number
```

```bash
set -euo pipefail
echo "ok"
```

```json
{ "ok": true, "n": 1 }
```

```yaml
ok: true
list: [1, 2]
```

```sql
SELECT id, title FROM notes WHERE title LIKE '%纸栈%';
```

```text
plain text block
```

Unknown language must degrade to plain text without failing:

```frobnicate
!! not a real language !!
```

A 45-line block crosses the 40-line fold threshold; lines are numbered in the
comment so slicing assertions stay exact.

```python
# line 01
# line 02
# line 03
# line 04
# line 05
# line 06
# line 07
# line 08
# line 09
# line 10
# line 11
# line 12
# line 13
# line 14
# line 15
# line 16
# line 17
# line 18
# line 19
# line 20
# line 21
# line 22
# line 23
# line 24
# line 25
# line 26
# line 27
# line 28
# line 29
# line 30
# line 31
# line 32
# line 33
# line 34
# line 35
# line 36
# line 37
# line 38
# line 39
# line 40
# line 41
# line 42
# line 43
# line 44
# line 45
```

键盘更新段落 KEYBOARD-UPDATE。
