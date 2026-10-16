## Why This Matters

Loops let a program repeat work without copying code. Almost every data task in the course uses a `for` loop.

## Key Terms to Know First

An **iterable** is anything you can loop over, such as a list or `range(5)`. The **loop variable** takes each value in turn.

## The Steps

1. Choose the iterable you want to walk through.
2. Write `for item in iterable:` and end the line with a colon.
3. Indent the body by four spaces.
4. Update any running total inside the body.

## Worked Example

Sum the even numbers below 10:

```python
total = 0
for n in range(10):
    if n % 2 == 0:
        total += n
print(total)  # 20
```

The condition n % 2 == 0 is true for 0, 2, 4, 6 and 8, so total grows 0 -> 2 -> 6 -> 12 -> 20.

## Traps and Mistakes

- Forgetting the colon at the end of the `for` line raises a SyntaxError.
- Mixing tabs and spaces breaks indentation.
- Decorators such as @staticmethod go above a method, not above a loop.

## Use It

Write a loop that counts how many words in a list have more than five letters, i.e. len(word) > 5.

## Recap from Memory

State the four steps of writing a `for` loop in order.

## Word Bank

- **Iterable**: an object you can loop over, such as a list
- **Loop variable**: the name that takes each value in turn
- **Indentation**: the leading spaces that mark the loop body
