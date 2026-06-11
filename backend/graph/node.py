class Node:
    def __init__(self, node_id, name, lat, lng, lighting_level=5, has_blue_light=False):
        self.node_id = node_id        # unique identifier
        self.name = name              # building or location name
        self.lat = lat                # latitude
        self.lng = lng                # longitude
        self.lighting_level = lighting_level  # 1-10 (10 = brightest)
        self.has_blue_light = has_blue_light  # is there a blue light phone here?

    def safety_bonus(self):
        # nodes with blue light phones and good lighting are safer
        bonus = self.lighting_level
        if self.has_blue_light:
            bonus += 5
        return bonus

    def __repr__(self):
        return f"Node({self.name}, lat={self.lat}, lng={self.lng})"