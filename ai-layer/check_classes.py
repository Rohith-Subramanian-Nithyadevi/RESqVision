from ultralytics import YOLO

model = YOLO('best_ff.pt')
print("model_f classes:", model.names)

model_a = YOLO('besta.pt')
print("model_a classes:", model_a.names)
