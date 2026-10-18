# Loops in Python

A for loop repeats a block of code once for each item in an iterable, such as a list or the sequence produced by range(). The line that starts the loop must end with a colon, and the body is indented by four spaces.

```python
total = 0
for n in range(10):
    if n % 2 == 0:
        total += n
print(total)  # 20
```

The example adds the even numbers below 10. The range(10) call produces the numbers 0 to 9. The condition n % 2 == 0 is true for even numbers, so total becomes 20.

# While loops

A while loop repeats as long as its condition stays true. If the condition never becomes false, the loop runs forever, which is called an infinite loop. Use break to leave a loop early and continue to skip to the next iteration.

```python
count = 3
while count > 0:
    print(count)
    count -= 1
```

# Common errors

Forgetting the colon raises a SyntaxError. Mixing tabs and spaces raises an IndentationError. Changing a list while looping over it can skip items.
