# uncompyle6 version 3.9.3
# Python bytecode version base 2.3 (62021)
# Decompiled from: Python 3.11.15 (main, Jun 23 2026, 15:46:51) [Clang 22.1.3 ]
# Embedded file name: spiro.pyw
import random, sys, os, pygame
from pygame.locals import *
path = os.path.dirname(os.path.abspath(sys.argv[0]))
os.chdir(path)
SCREENRECT = Rect(0, 0, 800, 600)
GRASSRECT = Rect(0, 0, SCREENRECT.width, SCREENRECT.height - 120)
GUIDERECT = Rect(0, 0, SCREENRECT.width, SCREENRECT.height - 110)
DIR_NONE = 0
DIR_UP = 1
DIR_DOWN = 2
DIR_LEFT = 3
DIR_RIGHT = 4
MAX_SCORE = 6

def load_image(name):
    """ Load image and return image object"""
    fullname = os.path.join('data', name)
    try:
        image = pygame.image.load(fullname)
        if image.get_alpha() is None:
            image = image.convert()
        else:
            image = image.convert_alpha()
    except pygame.error, message:
        print 'Cannot load image:', fullname
        raise SystemExit, message

    return image
    return


def load_images(*files):
    imgs = []
    for file in files:
        imgs.append(load_image(file))

    return imgs
    return


sound_dict = {}

def load_sounds():
    """loads all wav files in the data directory"""
    if not pygame.mixer:
        print 'no mixer'
        return
    files = os.listdir('data')
    for file in files:
        (sound_name, ext) = os.path.splitext(file)
        if ext == '.wav':
            sound_dict[sound_name] = pygame.mixer.Sound(os.path.join('data', file))

    return


def get_sound(sound_name):

    class dummy_sound:
        __module__ = __name__

        def play(*args):
            print 'dummy'
            return

    if sound_name in sound_dict:
        return sound_dict[sound_name]
    else:
        print 'unable to play sound "%s"' % sound_name
        return dummy_sound()
    return


def render_cage_text(size, name):
    surf = pygame.Surface(size)
    rect = surf.get_rect()
    surf.fill((0, 0, 0))
    if pygame.font:
        font = pygame.font.Font('data/ariblk.ttf', 24)
        text = font.render(name, 1, (255, 255, 255))
        textpos = text.get_rect()
        textpos.centerx = rect.centerx
        textpos.centery = rect.centery
        surf.blit(text, textpos)
    return (
     surf, rect)
    return


class Guide(pygame.sprite.Sprite):
    __module__ = __name__

    def __init__(self):
        pygame.sprite.Sprite.__init__(self, self.containers)
        self.clamprect = GUIDERECT
        img = load_image('guide.png')
        self.images = [pygame.transform.flip(img, 1, 0), img]
        self.image = self.images[0]
        self.rect = self.image.get_rect()
        self.rect.centerx = self.clamprect.centerx
        self.rect.top = self.clamprect.top
        self.speed = 5
        self.full = 0
        self.animal = Animal
        return

    def move(self, direction):
        if direction == DIR_UP:
            self.rect.move_ip(0, -self.speed)
        elif direction == DIR_DOWN:
            self.rect.move_ip(0, self.speed)
        elif direction == DIR_LEFT:
            self.image = self.images[0]
            self.rect.move_ip(-self.speed, 0)
        elif direction == DIR_RIGHT:
            self.image = self.images[1]
            self.rect.move_ip(self.speed, 0)
        self.rect = self.rect.clamp(self.clamprect)
        return

    def grabAnimal(self, animal):
        if not self.full:
            self.animal = animal
            self.full = self.animal.follow(self)
            if self.full == 1 and self.animal.free:
                sound = get_sound('gotcha')
                sound.play()
            return 1
        else:
            return 0
        return

    def lockupAnimal(self, cage):
        if self.full:
            self.animal.lockup(cage)
            if not self.animal.following:
                self.full = 0
        return


class Animal(pygame.sprite.Sprite):
    __module__ = __name__

    def __init__(self, name):
        pygame.sprite.Sprite.__init__(self, self.containers)
        self.name = name
        img = load_image(name + '.png')
        self.clamprect = GRASSRECT
        self.images = [img, pygame.transform.flip(img, 1, 0)]
        self.image = self.images[0]
        self.rect = self.image.get_rect()
        self.left = 0
        self.right = 1
        self.moveCount = random.randint(5, 25)
        self.direction = random.randint(0, 4)
        self.speed = random.randint(4, 9)
        self.rect = self.rect.clamp(self.clamprect)
        self.following = 0
        self.free = 1
        return

    def place(self, x, y):
        self.rect.centerx = x
        self.rect.centery = y
        return

    def move(self):
        if not self.following:
            self.moveCount = self.moveCount - 1
            if self.moveCount > 0:
                if self.direction == DIR_UP:
                    self.rect.move_ip(0, -self.speed)
                elif self.direction == DIR_DOWN:
                    self.rect.move_ip(0, self.speed)
                elif self.direction == DIR_LEFT:
                    self.image = self.images[self.left]
                    self.rect.move_ip(-self.speed, 0)
                elif self.direction == DIR_RIGHT:
                    self.image = self.images[self.right]
                    self.rect.move_ip(self.speed, 0)
                self.rect = self.rect.clamp(self.clamprect)
            else:
                self.moveCount = random.randint(15, 35)
                self.direction = random.randint(1, 4)
        else:
            self.rect.centerx = self.guide.rect.centerx + 10
            self.rect.bottom = self.guide.rect.centery - 10
        return

    def follow(self, guide):
        if self.free and not self.following:
            self.following = 1
            self.guide = guide
            sound = get_sound(self.name)
            sound.play()
            return 1
        else:
            return 0
        return

    def lockup(self, cage):
        if self.following:
            if cage.lockup(self) == 1:
                self.following = 0
        else:
            return 0
        return


class Cage(pygame.sprite.Sprite):
    __module__ = __name__

    def __init__(self, animal, number):
        pygame.sprite.Sprite.__init__(self, self.containers)
        self.name = animal.name
        size = (SCREENRECT.width / 6, 120)
        self.image = load_image('cage.png')
        self.image.set_colorkey((0, 255, 0))
        self.rect = self.image.get_rect()
        self.rect.left = size[0] * number
        self.rect.bottom = SCREENRECT.height
        self.rect = self.rect.clamp(SCREENRECT)
        self.full = 0
        return

    def lockup(self, animal):
        if not self.full:
            if animal.name == self.name:
                self.full = 1
                self.animal = animal
                self.animal.clamprect = self.rect
                self.animal.free = 0
                if not pygame.mixer.get_busy():
                    sound = get_sound('good_job')
                    sound.play()
                return 1
            elif not pygame.mixer.get_busy():
                sound = get_sound('wrong_cage')
                sound.play()
                return 2
        else:
            return 0
        return

    def unlock(self):
        if self.full:
            self.full = 0
            self.animal.clamprect = GRASSRECT
            self.animal.free = 1
        return

    def hasCorrectAnimal(self):
        if self.full and self.animal.name == self.name:
            return 1
        else:
            return 0
        return


class CageName(pygame.sprite.Sprite):
    __module__ = __name__

    def __init__(self, cage):
        pygame.sprite.Sprite.__init__(self, self.containers)
        size = (SCREENRECT.width / 6, 30)
        (self.image, self.rect) = render_cage_text(size, cage.name)
        self.rect.center = cage.rect.center
        return


def main(winstyle=0):
    pygame.init()
    pygame.mouse.set_visible(False)
    if pygame.mixer and not pygame.mixer.get_init():
        print 'Warning, no sound'
        pygame.mixer = None
    bestdepth = pygame.display.mode_ok(SCREENRECT.size, winstyle, 32)
    screen = pygame.display.set_mode(SCREENRECT.size, winstyle, bestdepth)
    pygame.display.set_caption("Spiro's Safari Park")
    welcome_image = load_image('welcome.png')
    way_to_go_image = load_image('way_to_go.png')
    screen.blit(welcome_image, (0, 0))
    pygame.display.flip()
    load_sounds()
    if pygame.mixer:
        music = os.path.join('data', 'house_lo.wav')
        pygame.mixer.music.load(music)
        pygame.mixer.music.play(-1)
        pygame.mixer.music.set_volume(0.75)
    done = False
    while not done:
        for event in pygame.event.get():
            if event.type == QUIT or event.type == KEYDOWN:
                done = True

    pygame.mixer.music.set_volume(0.25)
    background = pygame.Surface(screen.get_size())
    background = background.convert()
    background.fill((52, 106, 16))
    screen.blit(background, (0, 0))
    pygame.display.flip()
    animalGroup = pygame.sprite.Group()
    cageGroup = pygame.sprite.Group()
    cageNameGroup = pygame.sprite.Group()
    allGroup = pygame.sprite.RenderUpdates()
    Animal.containers = (
     animalGroup, allGroup)
    Cage.containers = (cageGroup, allGroup)
    CageName.containers = (cageNameGroup, allGroup)
    Guide.containers = allGroup
    clock = pygame.time.Clock()
    guide = Guide()
    beaver = Animal('beaver')
    elephant = Animal('elephant')
    monkey = Animal('monkey')
    monkey.left = 1
    monkey.right = 0
    penguin = Animal('penguin')
    penguin.left = 1
    penguin.right = 0
    snake = Animal('snake')
    zebra = Animal('zebra')
    animalList = (
     beaver, elephant, monkey, penguin, snake, zebra)
    beaverCage = Cage(beaver, 0)
    beaverCageText = CageName(beaverCage)
    elephantCage = Cage(elephant, 1)
    elephantCageText = CageName(elephantCage)
    monkeyCage = Cage(monkey, 2)
    monkeyCageText = CageName(monkeyCage)
    penguinCage = Cage(penguin, 3)
    penguinCageText = CageName(penguinCage)
    snakeCage = Cage(snake, 4)
    snakeCageText = CageName(snakeCage)
    zebraCage = Cage(zebra, 5)
    zebraCageText = CageName(zebraCage)
    cageList = (
     beaverCage, elephantCage, monkeyCage, penguinCage, snakeCage, zebraCage)
    sound = get_sound('intro')
    sound.play()
    beaverCage.lockup(beaver)
    elephantCage.lockup(elephant)
    monkeyCage.lockup(monkey)
    penguinCage.lockup(penguin)
    snakeCage.lockup(snake)
    zebraCage.lockup(zebra)
    clock.tick(30)
    totalTime = 0
    lockupTime = 16000
    locked = True
    score = 0
    done = False
    while not done:
        pygame.event.pump()
        totalTime = totalTime + clock.get_time()
        if locked and totalTime > lockupTime:
            locked = False
            beaverCage.unlock()
            elephantCage.unlock()
            monkeyCage.unlock()
            penguinCage.unlock()
            snakeCage.unlock()
            zebraCage.unlock()
            sound = get_sound('escaped')
            sound.play()
        for event in pygame.event.get():
            if event.type == QUIT or event.type == KEYDOWN and event.key == K_ESCAPE:
                done = True

        keystate = pygame.key.get_pressed()
        allGroup.clear(screen, background)
        allGroup.update()
        direction = DIR_NONE
        if keystate[K_UP]:
            direction = DIR_UP
        elif keystate[K_DOWN]:
            direction = DIR_DOWN
        elif keystate[K_LEFT]:
            direction = DIR_LEFT
        elif keystate[K_RIGHT]:
            direction = DIR_RIGHT
        guide.move(direction)
        for animal in animalList:
            animal.move()

        if totalTime > 23000:
            for theAnimal in pygame.sprite.spritecollide(guide, animalGroup, 0):
                guide.grabAnimal(theAnimal)

            for theCage in pygame.sprite.spritecollide(guide, cageGroup, 0):
                guide.lockupAnimal(theCage)

        score = 0
        if not locked:
            for theCage in cageList:
                score = score + theCage.hasCorrectAnimal()

        if score == MAX_SCORE:
            done = True
        dirty = allGroup.draw(screen)
        pygame.display.update(dirty)
        clock.tick(30)

    if score == MAX_SCORE:
        screen.blit(way_to_go_image, (0, 0))
        pygame.display.flip()
        sound = get_sound('youre_a_ranger')
        sound.play()
        while pygame.mixer.get_busy() > 0:
            x = 1

        sound = get_sound('ending')
        sound.play()
        while pygame.mixer.get_busy() > 0:
            x = 1

    if pygame.mixer:
        pygame.mixer.music.fadeout(1000)
    pygame.time.wait(1100)
    return


if __name__ == '__main__':
    main(FULLSCREEN)
return
