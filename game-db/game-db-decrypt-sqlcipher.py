"""Retired historical helper.

Real SQLCipher execution must go through a separately reviewed DQ adapter. This
file intentionally accepts no paths or secret material and performs no import of
the SQLCipher driver.
"""


def main() -> None:
    raise SystemExit(
        "This historical SQLCipher helper is disabled; no approved DQ process adapter exists."
    )


if __name__ == "__main__":
    main()
