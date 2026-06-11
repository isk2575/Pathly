class Edge:
    def __init__(self, edge_id, start_node, end_node, distance, lighting_level=5, report_count=0):
        self.edge_id = edge_id          # unique identifier
        self.start_node = start_node    # Node object where path starts
        self.end_node = end_node        # Node object where path ends
        self.distance = distance        # distance in meters
        self.lighting_level = lighting_level  # 1-10 (10 = brightest)
        self.report_count = report_count      # number of recent safety reports

    def safety_weight(self):
        # lower weight = safer path
        # distance is base cost
        # poor lighting increases cost
        # reports increase cost significantly
        weight = self.distance
        weight += (10 - self.lighting_level) * 10  # penalty for poor lighting
        weight += self.report_count * 50            # penalty for each report
        return weight

    def __repr__(self):
        return f"Edge({self.start_node.name} -> {self.end_node.name}, weight={self.safety_weight()})"