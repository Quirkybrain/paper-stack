# Math edge cases (rendering-pipeline §2.3)

Inline: $x^2 + y^2 = z^2$ and a Greek letter $\alpha$.

Block:

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

Dollar in inline code: `cost = $5` stays literal.

Dollar in a fenced block:

```text
price $5 and $10
```

Dollar in an indented block:

    total $20

Escaped money: \$20 does not start a formula.

Unclosed dollar: the text $abc continues readably.

Amount ambiguity: $5 and $10 must not be guessed as math.

Unknown macro (only this formula falls back): $\undefinedmacro{x}$

Wide formula (block-level horizontal scroll path):

$$
\sum_{i=1}^{n} \left( \frac{x_i - \bar{x}}{s_i} \right)^2 + \prod_{j=1}^{m} \frac{1}{1 + e^{-z_j}}
$$
