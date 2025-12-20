import random

ACTIONS = ["look_left", "look_right", "blink"]

def generate_challenge():
    return random.choice(ACTIONS)
