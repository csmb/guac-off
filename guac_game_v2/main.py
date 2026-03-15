import pygame
import sys
import os

# --- Global Variables ---
amp_powered = False
amp_cabled = False
gate_closed = True
puzzle_complete = False
show_tbc = False

# --- Constants ---
WINDOW_WIDTH, WINDOW_HEIGHT = 640, 400
SCALE = 1  # For future scaling if needed
FPS = 60
PLAYER_SIZE = 32
PLAYER_SPEED = 3
FONT_SIZE = 18
MENU_WIDTH, MENU_HEIGHT = 100, 70
DESC_HEIGHT = 40
INV_HEIGHT = 48
INV_ITEM_SIZE = 36
INV_MARGIN = 8

# Directions
DOWN, LEFT, RIGHT, UP = 0, 1, 2, 3

# --- Setup ---
pygame.init()
screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
pygame.display.set_caption("Point-and-Click Adventure Prototype")
clock = pygame.time.Clock()
font = pygame.font.SysFont(None, FONT_SIZE)

# --- Load Audio ---
def load_sound(filename):
    try:
        return pygame.mixer.Sound(os.path.join(os.path.dirname(__file__), filename))
    except Exception:
        return None

riff_sound = load_sound("riff.wav")
pickup_sound = load_sound("pickup.wav")
powerchord_sound = load_sound("powerchord.wav")
background_music = os.path.join(os.path.dirname(__file__), "background_riff.wav")

# --- Play background music loop ---
def play_background_music():
    if os.path.exists(background_music):
        pygame.mixer.music.load(background_music)
        pygame.mixer.music.set_volume(0.5)
        pygame.mixer.music.play(-1)
    else:
        pygame.mixer.music.stop()

play_background_music()

def play_riff():
    if riff_sound:
        riff_sound.play()

def play_pickup():
    if pickup_sound:
        pickup_sound.play()

def play_powerchord():
    if powerchord_sound:
        powerchord_sound.play()

# --- Placeholder Background ---
def draw_background(surface):
    surface.fill((40, 60, 120))
    pygame.draw.rect(surface, (80, 120, 200), (50, 300, 540, 50))  # ground
    pygame.draw.circle(surface, (200, 200, 80), (500, 100), 40)    # sun

# --- Placeholder Player Sprite (simple colored squares for animation frames) ---
def make_player_frames():
    frames = {d: [] for d in range(4)}
    colors = [
        [(200, 80, 80), (220, 120, 120), (180, 60, 60)],   # DOWN
        [(80, 200, 80), (120, 220, 120), (60, 180, 60)],   # LEFT
        [(80, 80, 200), (120, 120, 220), (60, 60, 180)],   # RIGHT
        [(200, 200, 80), (220, 220, 120), (180, 180, 60)], # UP
    ]
    for d in range(4):
        for c in colors[d]:
            surf = pygame.Surface((PLAYER_SIZE, PLAYER_SIZE), pygame.SRCALPHA)
            surf.fill(c)
            pygame.draw.rect(surf, (0,0,0), (0,0,PLAYER_SIZE,PLAYER_SIZE), 2)
            frames[d].append(surf)
    return frames

player_frames = make_player_frames()

# --- Inventory Item Class ---
class InventoryItem:
    def __init__(self, name, color, desc, combinable_with=None, result_item=None):
        self.name = name
        self.color = color
        self.desc = desc
        self.combinable_with = combinable_with or []  # list of item names
        self.result_item = result_item  # InventoryItem or None

# --- Example Inventory Items ---
item_broken_guitar = InventoryItem("Broken Guitar", (180, 100, 40), "A guitar with broken strings.", combinable_with=["Power Cable"], result_item=None)
item_rusty_key = InventoryItem("Rusty Key", (120, 120, 60), "A key covered in rust.")
item_power_cable = InventoryItem("Power Cable", (60, 60, 200), "A cable for powering devices.", combinable_with=["Broken Guitar"], result_item=None)
item_battery = InventoryItem("Battery", (200, 200, 40), "A 9V battery. Useful for powering things.")

# Combination logic (example: combine Broken Guitar + Power Cable = Fixed Guitar)
item_fixed_guitar = InventoryItem("Fixed Guitar", (100, 200, 100), "A guitar with a new power cable attached.")
item_broken_guitar.result_item = item_fixed_guitar
item_power_cable.result_item = item_fixed_guitar

# --- Scene Object Class ---
class SceneObject:
    def __init__(self, name, x, y, color, desc, can_pickup=False, use_text=None, required_item=None, on_use_result=None):
        self.name = name
        self.x = x
        self.y = y
        self.color = color
        self.rect = pygame.Rect(x-16, y-16, 32, 32)
        self.desc = desc
        self.can_pickup = can_pickup
        self.picked_up = False
        self.use_text = use_text or f"You can't use the {name} right now."
        self.required_item = required_item  # name of item required for special use
        self.on_use_result = on_use_result  # text or function
        self.solved = False

    def draw(self, surface):
        if not self.picked_up:
            pygame.draw.rect(surface, self.color, self.rect)
            pygame.draw.rect(surface, (0,0,0), self.rect, 2)

    def is_clicked(self, pos):
        return self.rect.collidepoint(pos) and not self.picked_up

# --- Example Objects ---
scene_objects = [
    SceneObject("Amp", 350, 270, (60, 60, 60), "A small amplifier. It needs power.", can_pickup=False, use_text="You plug something into the amp, but nothing happens.", required_item="Battery", on_use_result="You put the battery in the amp. It powers on!"),
]

# --- Metal Gate ---
gate_closed = True
gate_rect = pygame.Rect(580, 220, 40, 100)

def draw_gate(surface):
    if gate_closed:
        pygame.draw.rect(surface, (80, 80, 80), gate_rect)
        pygame.draw.rect(surface, (30, 30, 30), gate_rect, 4)
        txt = font.render("GATE", True, (200,200,200))
        surface.blit(txt, (gate_rect.x+2, gate_rect.y+35))

# --- Inventory ---
inventory = [item_broken_guitar, item_rusty_key, item_power_cable, item_battery]
selected_item_idx = None
hovered_item_idx = None
combining_item_idx = None

# --- Player Class ---
class Player:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.target = (x, y)
        self.direction = DOWN
        self.frame = 0
        self.frame_timer = 0
        self.frame_delay = 10  # frames per animation frame
        self.moving = False

    def update(self):
        dx = self.target[0] - self.x
        dy = self.target[1] - self.y
        dist = (dx**2 + dy**2) ** 0.5
        if dist > 2:
            self.moving = True
            angle = pygame.math.Vector2(dx, dy).angle_to((1, 0))
            if -45 <= angle < 45:
                self.direction = RIGHT
            elif 45 <= angle < 135:
                self.direction = UP
            elif -135 <= angle < -45:
                self.direction = DOWN
            else:
                self.direction = LEFT
            step = min(PLAYER_SPEED, dist)
            self.x += step * dx / dist
            self.y += step * dy / dist
            self.frame_timer += 1
            if self.frame_timer >= self.frame_delay:
                self.frame = (self.frame + 1) % len(player_frames[self.direction])
                self.frame_timer = 0
        else:
            self.moving = False
            self.frame = 0
            self.frame_timer = 0

    def draw(self, surface):
        img = player_frames[self.direction][self.frame]
        surface.blit(img, (int(self.x - PLAYER_SIZE//2), int(self.y - PLAYER_SIZE//2)))

player = Player(WINDOW_WIDTH//2, WINDOW_HEIGHT//2)

# --- Menu State ---
menu_active = False
menu_rect = pygame.Rect(0,0,MENU_WIDTH,MENU_HEIGHT)
menu_object = None
menu_options = ["Look", "Pick Up", "Use"]
menu_selected = -1

description_text = ""
desc_timer = 0
DESC_DISPLAY_TIME = 180  # frames (3 seconds)

# --- Dialogue/Text System ---
def show_dialogue(text):
    global description_text, desc_timer
    description_text = text
    desc_timer = DESC_DISPLAY_TIME

# --- Helper Functions ---
def draw_menu(surface, rect, options, selected):
    pygame.draw.rect(surface, (240,240,200), rect)
    pygame.draw.rect(surface, (0,0,0), rect, 2)
    for i, opt in enumerate(options):
        color = (0,0,0) if i != selected else (40,80,200)
        txt = font.render(opt, True, color)
        surface.blit(txt, (rect.x+10, rect.y+10+i*22))

def draw_description(surface, text):
    if text:
        desc_rect = pygame.Rect(0, WINDOW_HEIGHT-DESC_HEIGHT-INV_HEIGHT, WINDOW_WIDTH, DESC_HEIGHT)
        pygame.draw.rect(surface, (30,30,30), desc_rect)
        pygame.draw.rect(surface, (200,200,200), desc_rect, 2)
        txt = font.render(text, True, (255,255,255))
        surface.blit(txt, (10, WINDOW_HEIGHT-DESC_HEIGHT-INV_HEIGHT+10))

def draw_inventory(surface, items, selected_idx, hovered_idx, combining_idx):
    inv_rect = pygame.Rect(0, WINDOW_HEIGHT-INV_HEIGHT, WINDOW_WIDTH, INV_HEIGHT)
    pygame.draw.rect(surface, (60,60,60), inv_rect)
    pygame.draw.rect(surface, (200,200,200), inv_rect, 2)
    for i, obj in enumerate(items):
        x = INV_MARGIN + i*(INV_ITEM_SIZE+INV_MARGIN)
        y = WINDOW_HEIGHT-INV_HEIGHT+INV_MARGIN
        rect = pygame.Rect(x, y, INV_ITEM_SIZE, INV_ITEM_SIZE)
        pygame.draw.rect(surface, obj.color, rect)
        pygame.draw.rect(surface, (0,0,0), rect, 2)
        txt = font.render(obj.name[0], True, (0,0,0))
        surface.blit(txt, (x+8, y+8))
        if i == selected_idx:
            pygame.draw.rect(surface, (255,255,0), rect, 3)
        if i == hovered_idx:
            pygame.draw.rect(surface, (40,200,255), rect, 2)
        if i == combining_idx:
            pygame.draw.rect(surface, (0,255,0), rect, 3)

def draw_tbc(surface):
    tbc_rect = pygame.Rect(0, WINDOW_HEIGHT//2-40, WINDOW_WIDTH, 80)
    pygame.draw.rect(surface, (20,20,20), tbc_rect)
    pygame.draw.rect(surface, (200,0,0), tbc_rect, 4)
    txt = font.render("TO BE CONTINUED...", True, (255,255,255))
    surface.blit(txt, (WINDOW_WIDTH//2-txt.get_width()//2, WINDOW_HEIGHT//2-txt.get_height()//2))

# --- Main Loop ---
while True:
    mouse_pos = pygame.mouse.get_pos()
    menu_selected = -1
    hovered_item_idx = None
    combining_item_idx = None
    inv_y = WINDOW_HEIGHT-INV_HEIGHT
    inv_rects = [pygame.Rect(INV_MARGIN + i*(INV_ITEM_SIZE+INV_MARGIN), inv_y+INV_MARGIN, INV_ITEM_SIZE, INV_ITEM_SIZE) for i in range(len(inventory))]
    for i, rect in enumerate(inv_rects):
        if rect.collidepoint(mouse_pos):
            hovered_item_idx = i
            break

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            pygame.quit()
            sys.exit()
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            # Inventory click
            if hovered_item_idx is not None:
                if selected_item_idx is not None and selected_item_idx != hovered_item_idx:
                    # Try to combine
                    item1 = inventory[selected_item_idx]
                    item2 = inventory[hovered_item_idx]
                    if item2.name in item1.combinable_with and item1.result_item:
                        # Remove both, add result
                        inventory.pop(max(selected_item_idx, hovered_item_idx))
                        inventory.pop(min(selected_item_idx, hovered_item_idx))
                        inventory.append(item1.result_item)
                        show_dialogue(f"You combined {item1.name} and {item2.name}! Now that's some DIY metalwork.")
                        selected_item_idx = None
                    elif item1.name in item2.combinable_with and item2.result_item:
                        inventory.pop(max(selected_item_idx, hovered_item_idx))
                        inventory.pop(min(selected_item_idx, hovered_item_idx))
                        inventory.append(item2.result_item)
                        show_dialogue(f"You combined {item2.name} and {item1.name}! If only fixing my life was this easy.")
                        selected_item_idx = None
                    else:
                        show_dialogue("That combo's as useless as a drummer at soundcheck.")
                        selected_item_idx = None
                else:
                    # Select item
                    selected_item_idx = hovered_item_idx
                menu_active = False
                menu_object = None
            elif menu_active:
                # Click on menu
                for i in range(len(menu_options)):
                    opt_rect = pygame.Rect(menu_rect.x+5, menu_rect.y+10+i*22, MENU_WIDTH-10, 20)
                    if opt_rect.collidepoint(event.pos):
                        menu_selected = i
                        break
                if menu_selected != -1 and menu_object:
                    if menu_options[menu_selected] == "Look":
                        # Sarcastic, dark humor for Look
                        if menu_object.name == "Amp":
                            show_dialogue("This amp's more dead than my last three bands.")
                        elif menu_object.name == "Battery":
                            show_dialogue("A battery. More energy than my bassist on tour.")
                        elif menu_object.name == "Broken Guitar":
                            show_dialogue("Broken strings, broken dreams. Classic.")
                        elif menu_object.name == "Rusty Key":
                            show_dialogue("Rust never sleeps... neither do metalheads.")
                        elif menu_object.name == "Power Cable":
                            show_dialogue("A power cable. The lifeline of every gig... and every trip hazard.")
                        else:
                            show_dialogue(menu_object.desc)
                    elif menu_options[menu_selected] == "Pick Up":
                        if menu_object.can_pickup and not menu_object.picked_up:
                            menu_object.picked_up = True
                            # Add to inventory if not already present
                            if not any(obj.name == menu_object.name for obj in inventory):
                                inventory.append(menu_object)
                            show_dialogue(f"You picked up the {menu_object.name}. Score one for the hoarders.")
                            play_pickup()
                        else:
                            show_dialogue(f"You can't pick up the {menu_object.name}. Not even with a roadie's help.")
                    elif menu_options[menu_selected] == "Use":
                        if selected_item_idx is not None:
                            item = inventory[selected_item_idx]
                            # Puzzle logic: fix amp with battery and cable
                            if menu_object.name == "Amp":
                                if not amp_cabled and (item.name == "Power Cable" or item.name == "Fixed Guitar"):
                                    amp_cabled = True
                                    show_dialogue("You plug in the power cable. Now we're getting somewhere.")
                                    play_powerchord()
                                elif not amp_powered and item.name == "Battery":
                                    amp_powered = True
                                    show_dialogue("You put the battery in the amp. It powers on! Time to wake the neighbors.")
                                    play_powerchord()
                                elif amp_powered and amp_cabled and not puzzle_complete:
                                    puzzle_complete = True
                                    gate_closed = False
                                    show_tbc = True
                                    show_dialogue("The amp roars to life, the gate opens, and destiny awaits. TO BE CONTINUED...")
                                    play_powerchord()
                                else:
                                    show_dialogue(f"Trying to use {item.name} on {menu_object.name}? That's not how metal alchemy works.")
                                selected_item_idx = None
                            elif menu_object.required_item == item.name:
                                show_dialogue(menu_object.on_use_result or f"You used {item.name} on {menu_object.name}. Metal magic happens.")
                                selected_item_idx = None
                            else:
                                show_dialogue(f"Trying to use {item.name} on {menu_object.name}? That's not how metal alchemy works.")
                                selected_item_idx = None
                        else:
                            # Example: If using battery on amp
                            if menu_object.required_item:
                                show_dialogue(menu_object.use_text)
                            else:
                                show_dialogue(menu_object.use_text)
                    menu_active = False
                    menu_object = None
                else:
                    # Clicked outside menu
                    menu_active = False
                    menu_object = None
            else:
                # Check for object click
                for obj in scene_objects:
                    if obj.is_clicked(event.pos):
                        menu_active = True
                        menu_object = obj
                        mx, my = event.pos
                        menu_rect = pygame.Rect(mx, my, MENU_WIDTH, MENU_HEIGHT)
                        # Clamp menu to screen
                        if menu_rect.right > WINDOW_WIDTH:
                            menu_rect.x = WINDOW_WIDTH - MENU_WIDTH
                        if menu_rect.bottom > WINDOW_HEIGHT-INV_HEIGHT:
                            menu_rect.y = WINDOW_HEIGHT-INV_HEIGHT - MENU_HEIGHT
                        break
                else:
                    # Move player or use selected item on scene object
                    if selected_item_idx is not None:
                        selected_item_idx = None
                    else:
                        player.target = event.pos
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                menu_active = False
                menu_object = None
                selected_item_idx = None

    # Menu hover
    if menu_active:
        for i in range(len(menu_options)):
            opt_rect = pygame.Rect(menu_rect.x+5, menu_rect.y+10+i*22, MENU_WIDTH-10, 20)
            if opt_rect.collidepoint(mouse_pos):
                menu_selected = i
                break

    player.update()

    draw_background(screen)
    for obj in scene_objects:
        obj.draw(screen)
    player.draw(screen)
    draw_gate(screen)
    draw_inventory(screen, inventory, selected_item_idx, hovered_item_idx, combining_item_idx)
    if menu_active and menu_object:
        draw_menu(screen, menu_rect, menu_options, menu_selected)
    if description_text:
        draw_description(screen, description_text)
        if desc_timer > 0:
            desc_timer -= 1
        else:
            description_text = ""
    if show_tbc:
        draw_tbc(screen)

    pygame.display.flip()
    clock.tick(FPS) 